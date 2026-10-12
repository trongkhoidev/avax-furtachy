// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract DecisionAMM is Initializable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant BPS = 10_000;
    uint256 private constant PRICE_SCALE = 1e30; // 1e12 decimal normalization × 1e18 price precision
    uint256 private constant MINIMUM_LIQUIDITY = 1_000;

    error OnlyController();
    error Closed();
    error Expired();
    error InsufficientOutput();
    error LpLocked();
    error ZeroLiquidity();
    error InvalidParams();
    error TradingNotStarted();
    error TradingEnded();

    IERC20 public base;
    IERC20 public quote;
    uint256 public reserveBase;
    uint256 public reserveQuote;
    uint16 public feeBps;
    uint256 public totalShares;
    mapping(address => uint256) public shares;
    address public controller;
    bool public closed;
    bool public lpLocked;

    bool public twapEnabled;
    uint64 public twapStart;
    uint64 public tradingEnd;
    uint64 public lastUpdateTime;
    uint32 public minUpdateInterval;
    uint256 public lastObservation;
    uint256 public maxObsDelta;
    uint256 public aggregator;
    uint64 public aggregatorLastTime;

    struct Checkpoint { uint64 time; uint256 cumulative; }
    Checkpoint[] private _checkpoints;
    uint64 private _spotLastUpdate;
    uint256 private _spotObservation;
    uint256 private _spotCumulative;
    uint16 private _spotMaxDeltaBps;

    event Swap(address indexed sender, address indexed to, bool quoteToBase, uint256 amountIn, uint256 amountOut, uint256 reserveBase, uint256 reserveQuote);
    event LiquidityAdded(address indexed provider, uint256 baseAmt, uint256 quoteAmt, uint256 shares);
    event LiquidityRemoved(address indexed provider, uint256 baseAmt, uint256 quoteAmt, uint256 shares);
    event TwapUpdated(uint256 observation, uint256 spot, uint64 time);
    event ClosedPool();

    constructor() { _disableInitializers(); }

    function initialize(address base_, address quote_, uint16 feeBps_, address controller_, bool lpLocked_, uint32 minUpdateInterval_) external initializer {
        if (base_ == address(0) || quote_ == address(0) || base_ == quote_ || controller_ == address(0) || feeBps_ > 100 || minUpdateInterval_ == 0) revert InvalidParams();
        base = IERC20(base_);
        quote = IERC20(quote_);
        feeBps = feeBps_;
        controller = controller_;
        lpLocked = lpLocked_;
        minUpdateInterval = minUpdateInterval_;
        _spotMaxDeltaBps = 200;
    }

    function addLiquidity(uint256 baseAmt, uint256 quoteAmt, uint256 minShares, address to) external nonReentrant returns (uint256 minted) {
        if (closed) revert Closed();
        if (lpLocked && totalShares != 0) {
            if (!twapEnabled) revert TradingNotStarted();
            if (block.timestamp >= tradingEnd) revert TradingEnded();
        }
        if (baseAmt == 0 || quoteAmt == 0 || to == address(0)) revert ZeroLiquidity();
        if (totalShares == 0) {
            uint256 root = _sqrt(baseAmt * quoteAmt);
            if (root <= MINIMUM_LIQUIDITY) revert ZeroLiquidity();
            minted = root - MINIMUM_LIQUIDITY;
            totalShares = root;
            shares[address(0xdead)] += MINIMUM_LIQUIDITY;
        } else {
            uint256 baseSide = baseAmt * totalShares / reserveBase;
            uint256 quoteSide = quoteAmt * totalShares / reserveQuote;
            minted = baseSide < quoteSide ? baseSide : quoteSide;
            baseAmt = minted * reserveBase / totalShares;
            quoteAmt = minted * reserveQuote / totalShares;
            totalShares += minted;
        }
        if (minted < minShares || minted == 0) revert InsufficientOutput();
        base.safeTransferFrom(msg.sender, address(this), baseAmt);
        quote.safeTransferFrom(msg.sender, address(this), quoteAmt);
        reserveBase += baseAmt;
        reserveQuote += quoteAmt;
        shares[to] += minted;
        if (_checkpoints.length == 0) {
            _spotLastUpdate = uint64(block.timestamp);
            _spotObservation = spotPriceE18();
            _checkpoints.push(Checkpoint(uint64(block.timestamp), 0));
        }
        emit LiquidityAdded(to, baseAmt, quoteAmt, minted);
    }

    function removeLiquidity(uint256 shareAmount, uint256 minBase, uint256 minQuote, address to) external nonReentrant returns (uint256 baseOut, uint256 quoteOut) {
        if (lpLocked) revert LpLocked();
        if (shareAmount == 0 || shareAmount > shares[msg.sender]) revert ZeroLiquidity();
        baseOut = shareAmount * reserveBase / totalShares;
        quoteOut = shareAmount * reserveQuote / totalShares;
        if (baseOut < minBase || quoteOut < minQuote) revert InsufficientOutput();
        shares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;
        reserveBase -= baseOut;
        reserveQuote -= quoteOut;
        base.safeTransfer(to, baseOut);
        quote.safeTransfer(to, quoteOut);
        emit LiquidityRemoved(msg.sender, baseOut, quoteOut, shareAmount);
    }

    function swapExactQuoteForBase(uint256 quoteIn, uint256 minBaseOut, address to, uint64 deadline) external nonReentrant returns (uint256 amountOut) {
        if (closed) revert Closed();
        _requireTrading();
        if (block.timestamp > deadline) revert Expired();
        _updateTwap(uint64(block.timestamp), false);
        _updateSpotOracle();
        uint256 effective = quoteIn * (BPS - feeBps) / BPS;
        amountOut = reserveBase * effective / (reserveQuote + effective);
        if (amountOut < minBaseOut || amountOut == 0) revert InsufficientOutput();
        quote.safeTransferFrom(msg.sender, address(this), quoteIn);
        base.safeTransfer(to, amountOut);
        reserveQuote += quoteIn;
        reserveBase -= amountOut;
        emit Swap(msg.sender, to, true, quoteIn, amountOut, reserveBase, reserveQuote);
    }

    function swapExactBaseForQuote(uint256 baseIn, uint256 minQuoteOut, address to, uint64 deadline) external nonReentrant returns (uint256 amountOut) {
        if (closed) revert Closed();
        _requireTrading();
        if (block.timestamp > deadline) revert Expired();
        _updateTwap(uint64(block.timestamp), false);
        _updateSpotOracle();
        uint256 effective = baseIn * (BPS - feeBps) / BPS;
        amountOut = reserveQuote * effective / (reserveBase + effective);
        if (amountOut < minQuoteOut || amountOut == 0) revert InsufficientOutput();
        base.safeTransferFrom(msg.sender, address(this), baseIn);
        quote.safeTransfer(to, amountOut);
        reserveBase += baseIn;
        reserveQuote -= amountOut;
        emit Swap(msg.sender, to, false, baseIn, amountOut, reserveBase, reserveQuote);
    }

    function getAmountOut(bool quoteToBase, uint256 amountIn) external view returns (uint256) {
        if (reserveBase == 0 || reserveQuote == 0 || amountIn == 0) return 0;
        uint256 effective = amountIn * (BPS - feeBps) / BPS;
        return quoteToBase ? reserveBase * effective / (reserveQuote + effective) : reserveQuote * effective / (reserveBase + effective);
    }

    function spotPriceE18() public view returns (uint256) {
        if (reserveBase == 0) return 0;
        return reserveQuote * PRICE_SCALE / reserveBase;
    }

    function startTwap(uint64 start, uint64 end, uint256 initialObs, uint256 maxDelta) external {
        if (msg.sender != controller) revert OnlyController();
        if (twapEnabled || end <= start || initialObs == 0) revert InvalidParams();
        twapEnabled = true;
        twapStart = start;
        tradingEnd = end;
        lastUpdateTime = uint64(block.timestamp);
        aggregatorLastTime = uint64(block.timestamp);
        lastObservation = initialObs;
        maxObsDelta = maxDelta;
    }

    function crank() external { _updateTwap(uint64(block.timestamp), false); _updateSpotOracle(); }

    function finalizeTwap(uint64 endTime) external returns (uint256 twap) {
        if (msg.sender != controller) revert OnlyController();
        if (!twapEnabled || endTime <= twapStart) revert InvalidParams();
        _updateTwap(endTime, true);
        twap = aggregator / (endTime - twapStart);
    }

    function close() external {
        if (msg.sender != controller) revert OnlyController();
        if (closed) revert Closed();
        closed = true;
        lpLocked = false;
        emit ClosedPool();
    }

    function consult(uint32 secondsAgo) external view returns (uint256) {
        if (secondsAgo == 0) return spotPriceE18();
        if (_checkpoints.length < 2) return _spotObservation;
        uint64 target = uint64(block.timestamp - secondsAgo);
        Checkpoint memory beforePoint = _checkpoints[0];
        Checkpoint memory afterPoint = _checkpoints[_checkpoints.length - 1];
        for (uint256 i = _checkpoints.length; i > 0; --i) {
            Checkpoint memory point = _checkpoints[i - 1];
            if (point.time <= target) { beforePoint = point; break; }
            afterPoint = point;
        }
        if (target <= beforePoint.time) return _spotObservation;
        uint256 cumulativeTarget = beforePoint.cumulative;
        if (afterPoint.time > beforePoint.time) {
            cumulativeTarget += (afterPoint.cumulative - beforePoint.cumulative) * (target - beforePoint.time) / (afterPoint.time - beforePoint.time);
        }
        uint256 currentCumulative = _spotCumulative + _spotObservation * (block.timestamp - _spotLastUpdate);
        if (currentCumulative <= cumulativeTarget) return _spotObservation;
        return (currentCumulative - cumulativeTarget) / secondsAgo;
    }

    function checkpointCount() external view returns (uint256) { return _checkpoints.length; }

    function _updateTwap(uint64 time, bool force) private {
        if (!twapEnabled || time <= lastUpdateTime) return;
        if (!force && time < lastUpdateTime + minUpdateInterval) return;
        uint256 spot = spotPriceE18();
        uint256 nextObservation = spot;
        if (spot > lastObservation && spot - lastObservation > maxObsDelta) nextObservation = lastObservation + maxObsDelta;
        else if (lastObservation > spot && lastObservation - spot > maxObsDelta) nextObservation = lastObservation - maxObsDelta;
        uint64 until = time > tradingEnd ? tradingEnd : time;
        uint64 start = lastUpdateTime > twapStart ? lastUpdateTime : twapStart;
        if (until > start) aggregator += nextObservation * (until - start);
        lastObservation = nextObservation;
        lastUpdateTime = time;
        emit TwapUpdated(nextObservation, spot, time);
    }

    function _requireTrading() private view {
        if (lpLocked && !twapEnabled) revert TradingNotStarted();
        if (twapEnabled && block.timestamp >= tradingEnd) revert TradingEnded();
    }

    function _updateSpotOracle() private {
        if (_checkpoints.length == 0 || block.timestamp < _spotLastUpdate + minUpdateInterval) return;
        uint256 spot = spotPriceE18();
        uint256 delta = _spotObservation * _spotMaxDeltaBps / BPS;
        uint256 next = spot;
        if (spot > _spotObservation && spot - _spotObservation > delta) next = _spotObservation + delta;
        else if (_spotObservation > spot && _spotObservation - spot > delta) next = _spotObservation - delta;
        _spotCumulative += _spotObservation * (block.timestamp - _spotLastUpdate);
        _spotObservation = next;
        _spotLastUpdate = uint64(block.timestamp);
        _checkpoints.push(Checkpoint(uint64(block.timestamp), _spotCumulative));
    }

    function _sqrt(uint256 y) private pure returns (uint256 z) {
        if (y > 3) { z = y; uint256 x = y / 2 + 1; while (x < z) { z = x; x = (y / x + x) / 2; } }
        else if (y != 0) z = 1;
    }
}
