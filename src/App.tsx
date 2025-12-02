// src/App.tsx
import { useState } from "react";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useSendTransaction,
  useWriteContract,
} from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { parseEther, parseUnits } from "viem";
import { ConnectWalletButton } from "./ConnectWalletButton";

const API_BASE = "http://localhost:3000";

// Multisig na ETH (Safe na Ethereum)
const PRESALE_WALLET_ETH = "0x76aF211e9649f1469944f143FF27B24712af8343";
// Multisig na BNB
const PRESALE_WALLET_BSC =
  "0xfddcFB6f1F104793df8729D7Aa6c2B7183Ee3b55";

const CHAINS = {
  ETH: {
    key: "ETH" as const,
    chainId: 1,
    label: "ETH",
    nativeSymbol: "ETH",
    usdtAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT ERC20
    presaleWallet: PRESALE_WALLET_ETH,
  },
  BSC: {
    key: "BSC" as const,
    chainId: 56,
    label: "BNB",
    nativeSymbol: "BNB",
    usdtAddress: "0x55d398326f99059fF775485246999027B3197955", // USDT BEP20
    presaleWallet: PRESALE_WALLET_BSC,
  },
} as const;

const ERC20_ABI = [
  {
    type: "function",
    stateMutability: "nonpayable",
    outputs: [{ name: "", type: "bool" }],
    name: "transfer",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
  },
] as const;

function shortenAddress(addr?: string) {
  if (!addr) return "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

type Deposit = {
  txHash: string;
  chain: string;
  tokenSymbol: string;
  amountToken: number;
  amountUsd: number;
  tweAmount: number;
  phaseName: string | null;
  priceUsdPerTWE: number | null;
  createdAt: string;
};

type UserResponse = {
  address: string;
  totalTwe: number;
  totalUsd: number;
  deposits: Deposit[];
};

type RatesResponse = {
  phase: string;
  priceUsdPerTWE: number;
  totalSupply: number;
  soldSupply: number;
  progress: number; // 0–1
  ethUsd: number;
  bnbUsd: number;
  updatedAt: string;
};

// Mały helper do tabeli transakcji
function TransactionsTable({ deposits }: { deposits: Deposit[] }) {
  if (deposits.length === 0) {
    return (
      <p style={{ fontSize: 14, opacity: 0.7 }}>
        No purchases yet for this wallet.
      </p>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13,
        }}
      >
        <thead>
          <tr style={{ textAlign: "left", opacity: 0.7 }}>
            <th style={{ padding: "6px 4px" }}>Date</th>
            <th style={{ padding: "6px 4px" }}>Phase</th>
            <th style={{ padding: "6px 4px" }}>Token</th>
            <th style={{ padding: "6px 4px" }}>Paid</th>
            <th style={{ padding: "6px 4px" }}>TWE</th>
            <th style={{ padding: "6px 4px" }}>Tx Hash</th>
          </tr>
        </thead>
        <tbody>
          {deposits.map((d) => (
            <tr key={d.txHash + d.createdAt}>
              <td style={{ padding: "6px 4px" }}>
                {new Date(d.createdAt).toLocaleString()}
              </td>
              <td style={{ padding: "6px 4px" }}>{d.phaseName ?? "—"}</td>
              <td style={{ padding: "6px 4px" }}>
                {d.tokenSymbol} ({d.chain})
              </td>
              <td style={{ padding: "6px 4px" }}>
                ${d.amountUsd.toFixed(2)}
              </td>
              <td style={{ padding: "6px 4px" }}>
                {d.tweAmount.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}{" "}
                TWE
              </td>
              <td style={{ padding: "6px 4px", fontSize: 11 }}>
                {d.txHash.slice(0, 10)}...
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function App() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const {
    sendTransactionAsync,
    isPending: isTxPending,
  } = useSendTransaction();
  const {
    writeContractAsync,
    isPending: isWritePending,
  } = useWriteContract();

  const [activeTab, setActiveTab] = useState<
    "dashboard" | "buy" | "transactions" | "leaderboard" | "claim"
  >("dashboard");

  const [selectedChain, setSelectedChain] = useState<"ETH" | "BSC">(
    "BSC"
  );
  const [selectedToken, setSelectedToken] = useState<
    "USDT" | "NATIVE"
  >("USDT");

  // 🔹 Dane usera z backendu
  const userQuery = useQuery<UserResponse | null>({
    queryKey: ["user", address],
    enabled: isConnected && !!address,
    queryFn: async () => {
      if (!address) return null;
      const res = await fetch(`${API_BASE}/user/${address}`);
      if (!res.ok) throw new Error("Failed to load user data");
      return res.json();
    },
  });

  // 🔹 Dane o fazie / cenie / progresie
  const ratesQuery = useQuery<RatesResponse>({
    queryKey: ["rates"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/rates`);
      if (!res.ok) throw new Error("Failed to load rates");
      return res.json();
    },
  });

  const isUserLoading = userQuery.isLoading;
  const isUserError = userQuery.isError;

  const isRatesLoading = ratesQuery.isLoading;
  const isRatesError = ratesQuery.isError;

  const totalTwe = userQuery.data?.totalTwe ?? 0;
  const totalUsd = userQuery.data?.totalUsd ?? 0;
  const deposits = userQuery.data?.deposits ?? [];

  const currentPhase = ratesQuery.data?.phase ?? "—";
  const currentPrice = ratesQuery.data?.priceUsdPerTWE ?? 0;

  const progress = ratesQuery.data?.progress ?? 0; // 0–1
  const progressPercent = Math.max(0, Math.min(progress * 100, 100));

  const ethUsd = ratesQuery.data?.ethUsd ?? 0;
  const bnbUsd = ratesQuery.data?.bnbUsd ?? 0;

  // 🔹 Stan dla zakładki BUY
  const [usdAmount, setUsdAmount] = useState(100);

  const tweForUsd = currentPrice > 0 ? usdAmount / currentPrice : 0;
  const ethPay = ethUsd > 0 ? usdAmount / ethUsd : 0;
  const bnbPay = bnbUsd > 0 ? usdAmount / bnbUsd : 0;

  const MIN_USD = 50;

  // 🔹 Stan pod przycisk PAY
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [paySuccess, setPaySuccess] = useState<string | null>(null);

  async function handlePay() {
    if (!address) {
      setPayError("Connect your wallet first.");
      setPaySuccess(null);
      return;
    }

    const chainCfg =
      selectedChain === "ETH" ? CHAINS.ETH : CHAINS.BSC;

    if (
      !chainCfg.presaleWallet ||
      chainCfg.presaleWallet === "0xYOUR_ETH_SAFE_HERE"
    ) {
      setPayError(
        "Presale wallet address is not configured for this chain."
      );
      setPaySuccess(null);
      return;
    }

    if (!currentPrice || currentPrice <= 0) {
      setPayError("Price is not available. Try again in a moment.");
      setPaySuccess(null);
      return;
    }

    if (usdAmount < MIN_USD) {
      setPayError(`Minimum investment is $${MIN_USD}.`);
      setPaySuccess(null);
      return;
    }

    // 🔹 Spróbuj przełączyć sieć w portfelu, jeśli inna niż wybrana
    if (chainId !== chainCfg.chainId) {
      try {
        await (switchChain as any)?.({ chainId: chainCfg.chainId });
      } catch (err) {
        setPayError(
          `Switch your wallet network to ${chainCfg.label} and try again.`
        );
        setPaySuccess(null);
        return;
      }
    }

    setPayError(null);
    setPaySuccess(null);
    setIsPaying(true);

    try {
      if (selectedToken === "NATIVE") {
        // płatność ETH / BNB
        const nativeAmount =
          selectedChain === "ETH" ? ethPay : bnbPay;

        if (!nativeAmount || nativeAmount <= 0) {
          throw new Error("Calculated native amount is 0.");
        }

        const valueStr = nativeAmount.toFixed(6);

        const tx = await sendTransactionAsync({
          to: chainCfg.presaleWallet as `0x${string}`,
          value: parseEther(valueStr),
        } as any);

        const hash = (tx as any)?.hash ?? tx;
        setPaySuccess(`Transaction sent: ${hash}`);
      } else {
        // płatność USDT (ERC20 / BEP20)
        const usdtAmount = usdAmount; // 1 USDT ≈ 1 USD

        if (!usdtAmount || usdtAmount <= 0) {
          throw new Error("Calculated USDT amount is 0.");
        }

        const amountUnits = parseUnits(
          usdtAmount.toFixed(2),
          6
        ); // USDT ma 6 miejsc

        const tx = await writeContractAsync({
          address: chainCfg.usdtAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [
            chainCfg.presaleWallet as `0x${string}`,
            amountUnits,
          ],
        } as any);

        const hash = (tx as any)?.hash ?? tx;
        setPaySuccess(`USDT transfer sent: ${hash}`);
      }
    } catch (e: any) {
      console.error("PAY ERROR", e);
      setPayError(
        e?.shortMessage ||
          e?.message ||
          "Transaction failed or was rejected."
      );
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "24px 32px 40px",
        background: "#020617",
        color: "white",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Górny pasek */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, opacity: 0.7 }}>TradeWe</span>
          <h1 style={{ fontSize: 24, margin: 0 }}>
            TWE Presale Dashboard
          </h1>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <ConnectWalletButton />
          {isConnected && address && (
            <span
              style={{
                fontSize: 11,
                opacity: 0.75,
                textAlign: "right",
              }}
            >
              {shortenAddress(address)}
            </span>
          )}
        </div>
      </header>

      {/* Główna sekcja */}
      {!isConnected ? (
        <div
          style={{
            maxWidth: 520,
            padding: 24,
            borderRadius: 16,
            border: "1px solid rgba(148,163,184,0.4)",
            background:
              "radial-gradient(circle at top, rgba(56,189,248,0.15), transparent 60%) #020617",
          }}
        >
          <h2 style={{ fontSize: 20, marginTop: 0, marginBottom: 8 }}>
            Connect your wallet to continue
          </h2>
          <p
            style={{
              fontSize: 14,
              opacity: 0.8,
              lineHeight: 1.5,
              marginBottom: 16,
            }}
          >
            Połącz MetaMask / Rabby / Trust / WalletConnect, żeby
            zobaczyć swój balans TWE, historię wpłat i status presale.
          </p>
          <ul
            style={{
              fontSize: 14,
              opacity: 0.9,
              marginBottom: 16,
              paddingLeft: 20,
            }}
          >
            <li>podgląd ilości TWE przypisanych do Twojego adresu,</li>
            <li>lista wszystkich wpłat na multisig,</li>
            <li>informacja o aktualnej fazie i cenie presale.</li>
          </ul>
          <p style={{ fontSize: 12, opacity: 0.7 }}>
            Po połączeniu portfela od razu pokażemy pełny dashboard.
          </p>
        </div>
      ) : (
        <>
          {/* NAVBAR z zakładkami */}
          <nav
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 20,
              borderBottom: "1px solid rgba(31,41,55,0.9)",
              paddingBottom: 8,
            }}
          >
            {[
              { id: "dashboard", label: "Dashboard" },
              { id: "buy", label: "Buy TWE" },
              { id: "transactions", label: "Transactions" },
              { id: "leaderboard", label: "Leaderboard" },
              { id: "claim", label: "Claim (soon)" },
            ].map((tab) => {
              const isDisabled = tab.id === "claim";
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() =>
                    !isDisabled &&
                    setActiveTab(tab.id as typeof activeTab)
                  }
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: "none",
                    fontSize: 13,
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    background: isActive
                      ? "linear-gradient(90deg,#22c55e,#a3e635)"
                      : "transparent",
                    color: isActive ? "#020617" : "rgba(209,213,219,0.9)",
                    opacity: isDisabled ? 0.4 : 1,
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* ZAWARTOŚĆ KART */}
          {activeTab === "dashboard" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 24,
              }}
            >
              {/* Info o połączeniu */}
              <section
                style={{
                  padding: 20,
                  borderRadius: 16,
                  border: "1px solid rgba(148,163,184,0.4)",
                  background:
                    "radial-gradient(circle at top, rgba(52,211,153,0.15), transparent 60%) #020617",
                  maxWidth: 640,
                }}
              >
                <h2
                  style={{
                    fontSize: 18,
                    marginTop: 0,
                    marginBottom: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  Connected wallet
                  <span
                    style={{
                      fontSize: 11,
                      padding: "4px 8px",
                      borderRadius: 999,
                      background: "rgba(22,163,74,0.2)",
                      border: "1px solid rgba(22,163,74,0.7)",
                      textTransform: "uppercase",
                      letterSpacing: 0.06,
                    }}
                  >
                    Connected
                  </span>
                </h2>
                <p style={{ fontSize: 14, margin: 0, opacity: 0.9 }}>
                  {shortenAddress(address)}
                </p>
                <p style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
                  Dane poniżej pochodzą z backendu (
                  <code style={{ fontSize: 11 }}>/user/:address</code> i{" "}
                  <code style={{ fontSize: 11 }}>/rates</code>).
                </p>
              </section>

              {/* Kafle z podsumowaniem / info o błędach rates */}
              {isRatesLoading ? (
                <p
                  style={{
                    fontSize: 13,
                    opacity: 0.75,
                    maxWidth: 640,
                  }}
                >
                  Loading presale data...
                </p>
              ) : isRatesError ? (
                <p
                  style={{
                    fontSize: 13,
                    color: "#f97373",
                    maxWidth: 640,
                  }}
                >
                  Couldn’t load presale data. Please try again in a
                  moment.
                </p>
              ) : (
                <section
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 16,
                    maxWidth: 960,
                  }}
                >
                  <div
                    style={{
                      padding: 16,
                      borderRadius: 16,
                      border: "1px solid rgba(148,163,184,0.4)",
                      background: "#020617",
                    }}
                  >
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      Your TWE balance
                    </div>
                    <div style={{ fontSize: 24, marginTop: 8 }}>
                      {totalTwe.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}{" "}
                      TWE
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.6,
                        marginTop: 4,
                      }}
                    >
                      suma tweAmount z deposits
                    </div>
                  </div>

                  <div
                    style={{
                      padding: 16,
                      borderRadius: 16,
                      border: "1px solid rgba(148,163,184,0.4)",
                      background: "#020617",
                    }}
                  >
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      Total invested
                    </div>
                    <div style={{ fontSize: 24, marginTop: 8 }}>
                      $
                      {totalUsd.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.6,
                        marginTop: 4,
                      }}
                    >
                      suma amountUsd z deposits
                    </div>
                  </div>

                  <div
                    style={{
                      padding: 16,
                      borderRadius: 16,
                      border: "1px solid rgba(148,163,184,0.4)",
                      background: "#020617",
                    }}
                  >
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      Current phase
                    </div>
                    <div style={{ fontSize: 16, marginTop: 8 }}>
                      {currentPhase}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.6,
                        marginTop: 4,
                      }}
                    >
                      Price: ${currentPrice} / TWE
                    </div>
                    <div
                      style={{
                        marginTop: 10,
                        height: 10,
                        borderRadius: 999,
                        background: "rgba(15,23,42,0.95)",
                        overflow: "hidden",
                        border:
                          "1px solid rgba(190,242,100,0.9)", // limonkowy border
                        boxShadow:
                          "0 0 12px rgba(190,242,100,0.35)", // glow
                      }}
                    >
                      <div
                        style={{
                          width: `${progressPercent}%`,
                          height: "100%",
                          background:
                            "linear-gradient(90deg, #22c55e, #eab308, #f97316)",
                          transition: "width 0.3s ease-out",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        opacity: 0.7,
                        marginTop: 4,
                        display: "flex",
                        justifyContent: "space-between",
                        color: "rgba(226,232,240,0.9)",
                      }}
                    >
                      <span>Phase progress</span>
                      <span>{progressPercent.toFixed(2)}%</span>
                    </div>
                  </div>
                </section>
              )}

              {/* Ostatnie transakcje */}
              <section
                style={{
                  marginTop: 16,
                  maxWidth: 960,
                  padding: 16,
                  borderRadius: 16,
                  border: "1px solid rgba(148,163,184,0.4)",
                  background: "#020617",
                }}
              >
                <h3
                  style={{
                    marginTop: 0,
                    marginBottom: 12,
                    fontSize: 16,
                  }}
                >
                  Last transactions
                </h3>
                {isUserLoading ? (
                  <p>Loading transactions...</p>
                ) : isUserError ? (
                  <p style={{ fontSize: 13, color: "#f97373" }}>
                    Couldn’t load your transactions. Please try again
                    later.
                  </p>
                ) : (
                  <TransactionsTable
                    deposits={deposits.slice(0, 5)}
                  />
                )}
              </section>
            </div>
          )}

          {activeTab === "buy" && (
            <section
              style={{
                maxWidth: 640,
                padding: 20,
                borderRadius: 16,
                border: "1px solid rgba(148,163,184,0.4)",
                background: "#020617",
              }}
            >
              <h2
                style={{
                  fontSize: 18,
                  marginTop: 0,
                  marginBottom: 12,
                }}
              >
                Buy TWE
              </h2>
              <p
                style={{
                  fontSize: 13,
                  opacity: 0.8,
                  marginBottom: 12,
                }}
              >
                Wybierz chain, token płatności i wpisz wartość w USD
                (min ${MIN_USD}). Pokażemy ile TWE i ile tokena
                musisz zapłacić, a po kliknięciu Pay otworzy się
                okienko Twojego portfela (MetaMask / Rabby / Trust /
                WalletConnect).
              </p>

              {/* WYBÓR CHAINA */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 12,
                  fontSize: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ opacity: 0.7 }}>Choose your chain:</span>
                {(["ETH", "BSC"] as const).map((ch) => {
                  const cfg =
                    ch === "ETH" ? CHAINS.ETH : CHAINS.BSC;
                  const isActive = selectedChain === ch;
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setSelectedChain(ch)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        border:
                          "1px solid rgba(148,163,184,0.6)",
                        background: isActive
                          ? "linear-gradient(90deg,#22c55e,#a3e635)"
                          : "transparent",
                        color: isActive
                          ? "#020617"
                          : "rgba(226,232,240,0.9)",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>

              {/* WYBÓR COINA */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 16,
                  fontSize: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ opacity: 0.7 }}>
                  Choose your coin:
                </span>
                {(["USDT", "NATIVE"] as const).map((tok) => {
                  const isActive = selectedToken === tok;
                  const label =
                    tok === "USDT"
                      ? "USDT"
                      : CHAINS[selectedChain].nativeSymbol;
                  return (
                    <button
                      key={tok}
                      type="button"
                      onClick={() => setSelectedToken(tok)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        border:
                          "1px solid rgba(148,163,184,0.6)",
                        background: isActive
                          ? "linear-gradient(90deg,#22c55e,#a3e635)"
                          : "transparent",
                        color: isActive
                          ? "#020617"
                          : "rgba(226,232,240,0.9)",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {isRatesLoading && (
                <p
                  style={{
                    fontSize: 12,
                    opacity: 0.7,
                    marginBottom: 8,
                  }}
                >
                  Loading current rates...
                </p>
              )}
              {isRatesError && (
                <p
                  style={{
                    fontSize: 12,
                    color: "#f97373",
                    marginBottom: 8,
                  }}
                >
                  Couldn’t load rates. You can still test the Pay
                  flow, but price may be 0.
                </p>
              )}

              {/* Slider + input */}
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    opacity: 0.7,
                    marginBottom: 6,
                  }}
                >
                  <span>Amount in USD</span>
                  <span>
                    {usdAmount.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}{" "}
                    $
                  </span>
                </div>
                <input
                  type="range"
                  min={MIN_USD}
                  max={10000}
                  step={50}
                  value={usdAmount}
                  onChange={(e) =>
                    setUsdAmount(Number(e.target.value))
                  }
                  style={{ width: "100%" }}
                />
                <input
                  type="number"
                  value={usdAmount}
                  min={MIN_USD}
                  onChange={(e) =>
                    setUsdAmount(
                      Math.max(
                        MIN_USD,
                        Number(e.target.value) || MIN_USD
                      )
                    )
                  }
                  style={{
                    marginTop: 8,
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border:
                      "1px solid rgba(55,65,81,0.9)",
                    background: "#020617",
                    color: "white",
                  }}
                />
                <p
                  style={{
                    fontSize: 11,
                    opacity: 0.6,
                    marginTop: 6,
                  }}
                >
                  Minimum investment: ${MIN_USD}. Gas płacisz osobno z
                  portfela.
                </p>
              </div>

              {/* Podsumowanie ile dostaniesz */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                  marginTop: 8,
                }}
              >
                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border:
                      "1px solid rgba(148,163,184,0.35)",
                    background: "#020617",
                  }}
                >
                  <div
                    style={{ fontSize: 12, opacity: 0.7 }}
                  >
                    TWE you receive
                  </div>
                  <div
                    style={{ fontSize: 18, marginTop: 6 }}
                  >
                    {tweForUsd.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}{" "}
                    TWE
                  </div>
                  <div
                    style={{ fontSize: 11, opacity: 0.6 }}
                  >
                    Price: ${currentPrice} / TWE
                  </div>
                </div>

                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border:
                      "1px solid rgba(148,163,184,0.35)",
                    background: "#020617",
                  }}
                >
                  <div
                    style={{ fontSize: 12, opacity: 0.7 }}
                  >
                    {selectedToken === "USDT"
                      ? "USDT you pay"
                      : `${
                          CHAINS[selectedChain].nativeSymbol
                        } you pay`}
                  </div>
                  <div
                    style={{ fontSize: 18, marginTop: 6 }}
                  >
                    {selectedToken === "USDT"
                      ? usdAmount.toFixed(2)
                      : (
                          selectedChain === "ETH"
                            ? ethPay
                            : bnbPay
                        ).toFixed(6)}
                  </div>
                  <div
                    style={{ fontSize: 11, opacity: 0.6 }}
                  >
                    {selectedToken === "USDT"
                      ? "1 USDT ≈ 1 USD"
                      : selectedChain === "ETH"
                      ? `ETH price: $${ethUsd.toFixed(2)}`
                      : `BNB price: $${bnbUsd.toFixed(2)}`}
                  </div>
                </div>
              </div>

              <button
                onClick={handlePay}
                disabled={
                  isPaying ||
                  isTxPending ||
                  isWritePending ||
                  usdAmount < MIN_USD
                }
                style={{
                  marginTop: 20,
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 999,
                  border: "none",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor:
                    isPaying ||
                    isTxPending ||
                    isWritePending ||
                    usdAmount < MIN_USD
                      ? "not-allowed"
                      : "pointer",
                  background:
                    "linear-gradient(90deg,#22c55e,#a3e635)",
                  color: "#020617",
                  opacity:
                    isPaying ||
                    isTxPending ||
                    isWritePending ||
                    usdAmount < MIN_USD
                      ? 0.5
                      : 1,
                }}
              >
                {isPaying || isTxPending || isWritePending
                  ? "Waiting for wallet..."
                  : "Pay"}
              </button>
              <p
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  opacity: 0.6,
                }}
              >
                To jest już realne wysłanie transakcji: native (ETH /
                BNB) lub USDT na multisig presale. Backend może potem
                zaczytywać wpłaty z blockchaina i dopisywać depozyty
                do Twojej bazy.
              </p>

              {payError && (
                <p
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    color: "#f97373",
                  }}
                >
                  {payError}
                </p>
              )}
              {paySuccess && (
                <p
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    color: "#4ade80",
                    wordBreak: "break-all",
                  }}
                >
                  {paySuccess}
                </p>
              )}
            </section>
          )}

          {activeTab === "transactions" && (
            <section
              style={{
                maxWidth: 960,
                padding: 16,
                borderRadius: 16,
                border: "1px solid rgba(148,163,184,0.4)",
                background: "#020617",
              }}
            >
              <h2
                style={{
                  fontSize: 18,
                  marginTop: 0,
                  marginBottom: 12,
                }}
              >
                All transactions
              </h2>
              {isUserLoading ? (
                <p>Loading transactions...</p>
              ) : isUserError ? (
                <p style={{ fontSize: 13, color: "#f97373" }}>
                  Couldn’t load your transactions. Please try again
                  later.
                </p>
              ) : (
                <TransactionsTable deposits={deposits} />
              )}
            </section>
          )}

          {activeTab === "leaderboard" && (
            <section
              style={{
                maxWidth: 720,
                padding: 20,
                borderRadius: 16,
                border: "1px solid rgba(148,163,184,0.4)",
                background: "#020617",
              }}
            >
              <h2
                style={{
                  fontSize: 18,
                  marginTop: 0,
                  marginBottom: 8,
                }}
              >
                Leaderboard (soon)
              </h2>
              <p
                style={{
                  fontSize: 14,
                  opacity: 0.8,
                }}
              >
                Tutaj w wersji produkcyjnej pokażemy top hodlerów,
                liczbę transakcji i poziomy (Level 1, Level 2, itd.),
                podobnie jak w Remittix. Backend już zbiera dane,
                więc później tylko podłączymy API.
              </p>
            </section>
          )}

          {activeTab === "claim" && (
            <section
              style={{
                maxWidth: 640,
                padding: 20,
                borderRadius: 16,
                border: "1px solid rgba(148,163,184,0.4)",
                background: "#020617",
              }}
            >
              <h2
                style={{
                  fontSize: 18,
                  marginTop: 0,
                  marginBottom: 8,
                }}
              >
                Claim TWE (after TGE)
              </h2>
              <p
                style={{
                  fontSize: 14,
                  opacity: 0.8,
                }}
              >
                Opcja claim pojawi się dopiero po TGE. Wszystkie
                Twoje zakupy są już zapisane w bazie i będą dostępne
                do odbioru w odpowiedniej fazie.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default App;