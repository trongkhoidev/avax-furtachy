import type { LiveProject, LiveProposal } from "./live-data";

export const VERIFIED_PROJECTS: LiveProject[] = [
  {
    id: "1",
    founder: "0x4F534573497557933C19db3B8e53129064BdCD37",
    raise: "0x71C9415890298aed601595a70AB815c96711a31B01",
    token: "0x71C9415890298aed601595a70AB815c96711a31B02",
    treasury: "0x71C9415890298aed601595a70AB815c96711a31B03",
    governor: "0x71C9415890298aed601595a70AB815c96711a31B04",
    spotAmm: "0x71C9415890298aed601595a70AB815c96711a31B05",
    name: "WolfDAO Protocol",
    symbol: "WOLF",
    state: "LIVE",
    minRaise: "50000000000", // 50,000 USDC
    hardCap: "200000000000", // 200,000 USDC
    totalContributed: "185000000000", // 185,000 USDC
    acceptedTotal: "185000000000",
    metadataURI: "ipfs://bafkreifhklv2l4f6n7gqvpxi2q5tovk7h2a6x3x3o",
    createdAt: "1760000000",
  },
  {
    id: "2",
    founder: "0x82D0526901399bed7126a802616a97822b4242B1",
    raise: "0x82D0526901399bed7126a802616a97822b4242B2",
    token: "0x82D0526901399bed7126a802616a97822b4242B3",
    treasury: "0x82D0526901399bed7126a802616a97822b4242B4",
    governor: "0x82D0526901399bed7126a802616a97822b4242B5",
    spotAmm: "0x82D0526901399bed7126a802616a97822b4242B6",
    name: "Avalanche Teleporter Hub",
    symbol: "TELE",
    state: "LIVE",
    minRaise: "100000000000", // 100,000 USDC
    hardCap: "500000000000", // 500,000 USDC
    totalContributed: "320000000000", // 320,000 USDC
    acceptedTotal: "320000000000",
    metadataURI: "ipfs://bafkreidv5l5x7o2m4j4n3m4k5j6h7g8f9e0a1b2c3d",
    createdAt: "1760100000",
  },
  {
    id: "3",
    founder: "0x93E1637012400ced8237b913727b08933c5353C1",
    raise: "0x93E1637012400ced8237b913727b08933c5353C2",
    token: "0x93E1637012400ced8237b913727b08933c5353C3",
    treasury: "0x93E1637012400ced8237b913727b08933c5353C4",
    governor: "0x93E1637012400ced8237b913727b08933c5353C5",
    spotAmm: "0x93E1637012400ced8237b913727b08933c5353C6",
    name: "Sage AI Forecaster",
    symbol: "SAGE",
    state: "LIVE",
    minRaise: "25000000000", // 25,000 USDC
    hardCap: "100000000000", // 100,000 USDC
    totalContributed: "75000000000", // 75,000 USDC
    acceptedTotal: "75000000000",
    metadataURI: "ipfs://bafkreia7b6c5d4e3f2g1h0i9j8k7l6m5n4o3p2q1r",
    createdAt: "1760200000",
  },
];

export const VERIFIED_MARKETS: LiveProposal[] = [
  {
    id: "1",
    projectId: "1",
    projectName: "WolfDAO Protocol",
    projectSymbol: "WOLF",
    governor: "0x71C9415890298aed601595a70AB815c96711a31B04",
    proposer: "0x4F534573497557933C19db3B8e53129064BdCD37",
    title: "Deploy 100,000 USDC to seed Pass/Fail AMM Decision Pools",
    descriptionURI: "ipfs://bafkreifhklv2l4f6n7gqvpxi2q5tovk7h2a6x3x3o",
    state: "Trading",
    outcome: null,
    createdAt: "1760250000",
    tradingStart: "1760250000",
    tradingEnd: "1760850000",
    executionDeadline: "1761000000",
    passAmm: "0x71C9415890298aed601595a70AB815c96711a31A01",
    failAmm: "0x71C9415890298aed601595a70AB815c96711a31A02",
    passSpotE18: "1850000000000000000", // 1.85 USDC
    failSpotE18: "1120000000000000000", // 1.12 USDC
    twapPassE18: "1820000000000000000",
    twapFailE18: "1140000000000000000",
  },
  {
    id: "2",
    projectId: "2",
    projectName: "Avalanche Teleporter Hub",
    projectSymbol: "TELE",
    governor: "0x82D0526901399bed7126a802616a97822b4242B5",
    proposer: "0x82D0526901399bed7126a802616a97822b4242B1",
    title: "Activate Avalanche Fuji Inter-Subnet Teleporter Route",
    descriptionURI: "ipfs://bafkreidv5l5x7o2m4j4n3m4k5j6h7g8f9e0a1b2c3d",
    state: "Trading",
    outcome: null,
    createdAt: "1760260000",
    tradingStart: "1760260000",
    tradingEnd: "1760900000",
    executionDeadline: "1761100000",
    passAmm: "0x82D0526901399bed7126a802616a97822b4242A1",
    failAmm: "0x82D0526901399bed7126a802616a97822b4242A2",
    passSpotE18: "2450000000000000000", // 2.45 USDC
    failSpotE18: "1780000000000000000", // 1.78 USDC
    twapPassE18: "2400000000000000000",
    twapFailE18: "1800000000000000000",
  },
  {
    id: "3",
    projectId: "3",
    projectName: "Sage AI Forecaster",
    projectSymbol: "SAGE",
    governor: "0x93E1637012400ced8237b913727b08933c5353C5",
    proposer: "0xBB1f2226822f1514be5d15234d22AdF03B23ffb3",
    title: "Incentivize ERC-8004 AI Forecaster Reputation Verification",
    descriptionURI: "ipfs://bafkreia7b6c5d4e3f2g1h0i9j8k7l6m5n4o3p2q1r",
    state: "Trading",
    outcome: null,
    createdAt: "1760270000",
    tradingStart: "1760270000",
    tradingEnd: "1760950000",
    executionDeadline: "1761200000",
    passAmm: "0x93E1637012400ced8237b913727b08933c5353A1",
    failAmm: "0x93E1637012400ced8237b913727b08933c5353A2",
    passSpotE18: "3100000000000000000", // 3.10 USDC
    failSpotE18: "2650000000000000000", // 2.65 USDC
    twapPassE18: "3050000000000000000",
    twapFailE18: "2680000000000000000",
  },
  {
    id: "4",
    projectId: "1",
    projectName: "WolfDAO Protocol",
    projectSymbol: "WOLF",
    governor: "0x71C9415890298aed601595a70AB815c96711a31B04",
    proposer: "0x4F534573497557933C19db3B8e53129064BdCD37",
    title: "Authorize 30% Decision AMM Protocol Fee Buyback",
    descriptionURI: "ipfs://bafkreifhklv2l4f6n7gqvpxi2q5tovk7h2a6x3x3o",
    state: "Passed",
    outcome: "Passed",
    createdAt: "1759900000",
    tradingStart: "1759900000",
    tradingEnd: "1760200000",
    executionDeadline: "1760500000",
    passAmm: "0x71C9415890298aed601595a70AB815c96711a31A03",
    failAmm: "0x71C9415890298aed601595a70AB815c96711a31A04",
    passSpotE18: "2100000000000000000",
    failSpotE18: "1300000000000000000",
    twapPassE18: "2050000000000000000",
    twapFailE18: "1350000000000000000",
  },
];
