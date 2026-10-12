// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IFutaraFactory} from "../interfaces/IFutaraFactory.sol";

interface IRouterGovernor { function getMarket(uint256 id) external view returns (address vaultUsdc, address vaultToken, address passAmm, address failAmm); }
interface IRouterVault {
    function underlying() external view returns (IERC20);
    function passToken() external view returns (IERC20);
    function failToken() external view returns (IERC20);
    function outcome() external view returns (uint8);
    function split(uint256 amount, address to) external;
    function merge(uint256 amount, address to) external;
    function redeem(address to) external returns (uint256);
}
interface IRouterAmm {
    function addLiquidity(uint256 baseAmt, uint256 quoteAmt, uint256 minShares, address to) external returns (uint256);
    function swapExactQuoteForBase(uint256 amountIn, uint256 minOut, address to, uint64 deadline) external returns (uint256);
    function swapExactBaseForQuote(uint256 amountIn, uint256 minOut, address to, uint64 deadline) external returns (uint256);
}

/// @notice Atomic conditional-token helpers. All underlying assets and residual tokens are returned in the same call.
contract FutaraRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IFutaraFactory public immutable factory;

    error InvalidMarket();
    error DeadlineExpired();

    event OutcomeBought(address indexed user, address indexed governor, uint256 indexed proposalId, bool pass, uint256 usdcIn, uint256 tokenOut, uint256 oppositeUsdcOut);
    event OutcomeSold(address indexed user, address indexed governor, uint256 indexed proposalId, bool pass, uint256 tokenIn, uint256 usdcOut, uint256 oppositeTokenOut);

    constructor(IFutaraFactory factory_) { require(address(factory_) != address(0), "zero factory"); factory = factory_; }

    function buyOutcome(address governor, uint256 proposalId, bool pass, IERC20 usdc, uint256 usdcIn, uint256 minTokenOut, uint64 deadline) external nonReentrant returns (uint256 tokenOut) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        _requireGovernor(governor);
        (address usdcVaultAddr,, address passAmm, address failAmm) = IRouterGovernor(governor).getMarket(proposalId);
        if (usdcVaultAddr == address(0)) revert InvalidMarket();
        IRouterVault usdcVault = IRouterVault(usdcVaultAddr);
        if (address(usdcVault.underlying()) != address(usdc)) revert InvalidMarket();
        IERC20 passUsdc = usdcVault.passToken();
        IERC20 failUsdc = usdcVault.failToken();
        usdc.safeTransferFrom(msg.sender, address(this), usdcIn);
        usdc.forceApprove(usdcVaultAddr, usdcIn);
        usdcVault.split(usdcIn, address(this));
        IERC20 selectedUsdc = pass ? passUsdc : failUsdc;
        IERC20 oppositeUsdc = pass ? failUsdc : passUsdc;
        selectedUsdc.forceApprove(pass ? passAmm : failAmm, usdcIn);
        tokenOut = IRouterAmm(pass ? passAmm : failAmm).swapExactQuoteForBase(usdcIn, minTokenOut, address(this), deadline);
        IERC20 selectedToken = IRouterVault(_tokenVault(governor, proposalId)).passToken();
        if (!pass) selectedToken = IRouterVault(_tokenVault(governor, proposalId)).failToken();
        selectedToken.safeTransfer(msg.sender, tokenOut);
        uint256 oppositeOut = oppositeUsdc.balanceOf(address(this));
        oppositeUsdc.safeTransfer(msg.sender, oppositeOut);
        emit OutcomeBought(msg.sender, governor, proposalId, pass, usdcIn, tokenOut, oppositeOut);
    }

    function sellOutcome(address governor, uint256 proposalId, bool pass, IERC20 token, uint256 tokenIn, uint256 minUsdcOut, uint64 deadline) external nonReentrant returns (uint256 usdcOut) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        _requireGovernor(governor);
        (, address tokenVaultAddr, address passAmm, address failAmm) = IRouterGovernor(governor).getMarket(proposalId);
        if (tokenVaultAddr == address(0)) revert InvalidMarket();
        IRouterVault tokenVault = IRouterVault(tokenVaultAddr);
        if (address(tokenVault.underlying()) != address(token)) revert InvalidMarket();
        IERC20 passToken = tokenVault.passToken();
        IERC20 failToken = tokenVault.failToken();
        token.safeTransferFrom(msg.sender, address(this), tokenIn);
        token.forceApprove(tokenVaultAddr, tokenIn);
        tokenVault.split(tokenIn, address(this));
        IERC20 selectedToken = pass ? passToken : failToken;
        IERC20 oppositeToken = pass ? failToken : passToken;
        address amm = pass ? passAmm : failAmm;
        selectedToken.forceApprove(amm, tokenIn);
        usdcOut = IRouterAmm(amm).swapExactBaseForQuote(tokenIn, minUsdcOut, address(this), deadline);
        IRouterVault usdcVault = IRouterVault(_usdcVault(governor, proposalId));
        IERC20 selectedUsdc = pass ? usdcVault.passToken() : usdcVault.failToken();
        selectedUsdc.safeTransfer(msg.sender, usdcOut);
        uint256 oppositeOut = oppositeToken.balanceOf(address(this));
        oppositeToken.safeTransfer(msg.sender, oppositeOut);
        emit OutcomeSold(msg.sender, governor, proposalId, pass, tokenIn, usdcOut, oppositeOut);
    }

    function mergeAll(address governor, uint256 proposalId) external nonReentrant returns (uint256 usdcOut, uint256 tokenOut) {
        _requireGovernor(governor);
        (address usdcVaultAddr, address tokenVaultAddr,,) = IRouterGovernor(governor).getMarket(proposalId);
        if (usdcVaultAddr == address(0) || tokenVaultAddr == address(0)) revert InvalidMarket();
        IRouterVault usdcVault = IRouterVault(usdcVaultAddr);
        IRouterVault tokenVault = IRouterVault(tokenVaultAddr);
        IERC20 usdc = usdcVault.underlying();
        IERC20 token = tokenVault.underlying();
        IERC20 pUsdc = usdcVault.passToken(); IERC20 fUsdc = usdcVault.failToken();
        IERC20 pToken = tokenVault.passToken(); IERC20 fToken = tokenVault.failToken();
        uint256 usdcPair = _min(pUsdc.balanceOf(msg.sender), fUsdc.balanceOf(msg.sender));
        uint256 tokenPair = _min(pToken.balanceOf(msg.sender), fToken.balanceOf(msg.sender));
        if (usdcPair > 0) { pUsdc.safeTransferFrom(msg.sender, address(this), usdcPair); fUsdc.safeTransferFrom(msg.sender, address(this), usdcPair); usdcVault.merge(usdcPair, address(this)); usdcOut = usdcPair; }
        if (tokenPair > 0) { pToken.safeTransferFrom(msg.sender, address(this), tokenPair); fToken.safeTransferFrom(msg.sender, address(this), tokenPair); tokenVault.merge(tokenPair, address(this)); tokenOut = tokenPair; }
        usdc.safeTransfer(msg.sender, usdcOut); token.safeTransfer(msg.sender, tokenOut);
    }

    function redeemAll(address governor, uint256 proposalId) external nonReentrant returns (uint256 usdcOut, uint256 tokenOut) {
        _requireGovernor(governor);
        (address usdcVaultAddr, address tokenVaultAddr,,) = IRouterGovernor(governor).getMarket(proposalId);
        if (usdcVaultAddr == address(0) || tokenVaultAddr == address(0)) revert InvalidMarket();
        IRouterVault usdcVault = IRouterVault(usdcVaultAddr); IRouterVault tokenVault = IRouterVault(tokenVaultAddr);
        IERC20 usdc = usdcVault.underlying(); IERC20 token = tokenVault.underlying();
        uint8 usdcOutcome = usdcVault.outcome(); uint8 tokenOutcome = tokenVault.outcome();
        if (usdcOutcome == 0 || usdcOutcome > 2 || tokenOutcome == 0 || tokenOutcome > 2) revert InvalidMarket();
        uint256 usdcWinning = _collectWinning(usdcVault, msg.sender);
        uint256 tokenWinning = _collectWinning(tokenVault, msg.sender);
        if (usdcWinning > 0) usdcOut = usdcVault.redeem(address(this));
        if (tokenWinning > 0) tokenOut = tokenVault.redeem(address(this));
        if (usdcOut > 0) usdc.safeTransfer(msg.sender, usdcOut);
        if (tokenOut > 0) token.safeTransfer(msg.sender, tokenOut);
    }

    function splitAndProvide(address governor, uint256 proposalId, uint256 usdcIn, uint256 tokenIn, uint256 minPassShares, uint256 minFailShares) external nonReentrant returns (uint256 passShares, uint256 failShares) {
        _requireGovernor(governor);
        (address usdcVaultAddr, address tokenVaultAddr, address passAmm, address failAmm) = IRouterGovernor(governor).getMarket(proposalId);
        if (usdcVaultAddr == address(0) || tokenVaultAddr == address(0)) revert InvalidMarket();
        IRouterVault usdcVault = IRouterVault(usdcVaultAddr); IRouterVault tokenVault = IRouterVault(tokenVaultAddr);
        IERC20 usdc = usdcVault.underlying(); IERC20 token = tokenVault.underlying();
        usdc.safeTransferFrom(msg.sender, address(this), usdcIn); token.safeTransferFrom(msg.sender, address(this), tokenIn);
        usdc.forceApprove(usdcVaultAddr, usdcIn); token.forceApprove(tokenVaultAddr, tokenIn);
        usdcVault.split(usdcIn, address(this)); tokenVault.split(tokenIn, address(this));
        IERC20 pUsdc = usdcVault.passToken(); IERC20 fUsdc = usdcVault.failToken();
        IERC20 pToken = tokenVault.passToken(); IERC20 fToken = tokenVault.failToken();
        pToken.forceApprove(passAmm, tokenIn); pUsdc.forceApprove(passAmm, usdcIn);
        fToken.forceApprove(failAmm, tokenIn); fUsdc.forceApprove(failAmm, usdcIn);
        passShares = IRouterAmm(passAmm).addLiquidity(tokenIn, usdcIn, minPassShares, msg.sender);
        failShares = IRouterAmm(failAmm).addLiquidity(tokenIn, usdcIn, minFailShares, msg.sender);
        _refund(pUsdc, msg.sender); _refund(fUsdc, msg.sender); _refund(pToken, msg.sender); _refund(fToken, msg.sender);
    }

    function swapSpot(uint256 projectId, IERC20 tokenIn, uint256 amountIn, uint256 minOut, uint64 deadline) external nonReentrant returns (uint256 amountOut) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        IFutaraFactory.ProjectInfo memory project = factory.getProject(projectId);
        if (project.spotAmm == address(0)) revert InvalidMarket();
        IERC20 usdc = factory.usdc();
        if (address(tokenIn) != address(usdc) && address(tokenIn) != project.token) revert InvalidMarket();
        tokenIn.safeTransferFrom(msg.sender, address(this), amountIn);
        tokenIn.forceApprove(project.spotAmm, amountIn);
        if (address(tokenIn) == address(usdc)) amountOut = IRouterAmm(project.spotAmm).swapExactQuoteForBase(amountIn, minOut, address(this), deadline);
        else amountOut = IRouterAmm(project.spotAmm).swapExactBaseForQuote(amountIn, minOut, address(this), deadline);
        IERC20 tokenOut = address(tokenIn) == address(usdc) ? IERC20(project.token) : usdc;
        tokenOut.safeTransfer(msg.sender, amountOut);
    }

    function _collectWinning(IRouterVault vault, address user) private returns (uint256 balance) {
        uint8 outcome_ = vault.outcome();
        IERC20 winning = outcome_ == 1 ? vault.passToken() : vault.failToken();
        balance = winning.balanceOf(user);
        if (balance > 0) winning.safeTransferFrom(user, address(this), balance);
    }

    function _refund(IERC20 asset, address to) private {
        uint256 balance = asset.balanceOf(address(this));
        if (balance > 0) asset.safeTransfer(to, balance);
    }

    function _tokenVault(address governor, uint256 proposalId) private view returns (address tokenVault) { (, tokenVault,,) = IRouterGovernor(governor).getMarket(proposalId); }
    function _usdcVault(address governor, uint256 proposalId) private view returns (address usdcVault) { (usdcVault,,,) = IRouterGovernor(governor).getMarket(proposalId); }
    function _requireGovernor(address governor) private view { require(factory.projectIdOf(governor) != 0, "unknown governor"); }
    function _min(uint256 a, uint256 b) private pure returns (uint256) { return a < b ? a : b; }
}
