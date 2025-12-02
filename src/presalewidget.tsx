// src/PresaleWidget.tsx
import { useState } from "react";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useSendTransaction,
  useWriteContract,
} from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import { parseEther, parseUnits } from "viem";

// ⬇ możesz to później wyciągnąć do wspólnego pliku z App.tsx
const API_BASE = "http://localhost:3000";

const PRESALE_WALLET_ETH = "0x76aF211e9649f1469944f143FF27B24712af8343";
const PRESALE_WALLET_BSC = "0xfddcFB6f1F104793df8729D7Aa6c2B7183Ee3b55";

const CHAINS = {
  ETH: {
    key: "ETH" as const,
    chainId: 1,
    label: "ETH",
    nativeSymbol: "ETH",
    usdtAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // ERC20
    presaleWallet: PRESALE_WALLET_ETH,
  },
  BSC: {
    key: "BSC" as const,
    chainId: 56,
    label: "BNB",
    nativeSymbol: "BNB",
    usdtAddress: "0x55d398326f99059fF775485246999027B3197955", // BEP20
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

type RatesResponse = {
  phase: string;
  priceUsdPerTWE: number;
  totalSupply: number;
  soldSupply: number;
  progress: number;
  ethUsd: number;
  bnbUsd: number;
  updatedAt: string;
};

const MIN_USD = 50;

export function PresaleWidget() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { open } = useWeb3Modal();

  const { sendTransactionAsync, isPending: isTxPending } =
    useSendTransaction();
  const { writeContractAsync, isPending: isWritePending } =
    useWriteContract();

  const { data: rates } = useQuery<RatesResponse>({
    queryKey: ["rates"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/rates`);
      if (!res.ok) throw new Error("Failed to load rates");
      return res.json();
    },
  });

  const currentPrice = rates?.priceUsdPerTWE ?? 0;
  const progress = rates?.progress ?? 0;
  const progressPercent = Math.max(0, Math.min(progress * 100, 100));
  const ethUsd = rates?.ethUsd ?? 0;
  const bnbUsd = rates?.bnbUsd ?? 0;

  const [selectedChain, setSelectedChain] = useState<"ETH" | "BSC">("BSC");
  const [selectedToken, setSelectedToken] = useState<"USDT" | "NATIVE">(
    "NATIVE"
  );
  const [usdAmount, setUsdAmount] = useState(100);
  const [payError, setPayError] = useState<string | null>(null);
  const [paySuccess, setPaySuccess] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  const tweForUsd = currentPrice > 0 ? usdAmount / currentPrice : 0;
  const ethPay = ethUsd > 0 ? usdAmount / ethUsd : 0;
  const bnbPay = bnbUsd > 0 ? usdAmount / bnbUsd : 0;

  const chainCfg = selectedChain === "ETH" ? CHAINS.ETH : CHAINS.BSC;

  async function handlePay() {
    setPayError(null);
    setPaySuccess(null);

    // 1) jeśli nie ma portfela → najpierw connect
    if (!isConnected || !address) {
      await open();
      return;
    }

    if (usdAmount < MIN_USD) {
      setPayError(`Minimum investment is $${MIN_USD}.`);
      return;
    }

    if (!currentPrice || currentPrice <= 0) {
      setPayError("Price is not available. Try again in a moment.");
      return;
    }

    if (chainId !== chainCfg.chainId) {
      try {
        await (switchChain as any)?.({ chainId: chainCfg.chainId });
      } catch {
        setPayError(
          `Switch your wallet network to ${chainCfg.label} and try again.`
        );
        return;
      }
    }

    setIsPaying(true);

    try {
      if (selectedToken === "NATIVE") {
        const nativeAmount = selectedChain === "ETH" ? ethPay : bnbPay;
        if (!nativeAmount || nativeAmount <= 0)
          throw new Error("Calculated native amount is 0.");

        const tx = await sendTransactionAsync({
          to: chainCfg.presaleWallet as `0x${string}`,
          value: parseEther(nativeAmount.toFixed(6)),
        } as any);

        const hash = (tx as any)?.hash ?? tx;
        setPaySuccess(`Transaction sent: ${hash}`);
      } else {
        const usdtAmount = usdAmount;
        if (!usdtAmount || usdtAmount <= 0)
          throw new Error("Calculated USDT amount is 0.");

        const amountUnits = parseUnits(usdtAmount.toFixed(2), 6);
        const tx = await writeContractAsync({
          address: chainCfg.usdtAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [chainCfg.presaleWallet as `0x${string}`, amountUnits],
        } as any);

        const hash = (tx as any)?.hash ?? tx;
        setPaySuccess(`USDT transfer sent: ${hash}`);
      }
    } catch (e: any) {
      console.error("WIDGET PAY ERROR", e);
      setPayError(
        e?.shortMessage || e?.message || "Transaction failed or was rejected."
      );
    } finally {
      setIsPaying(false);
    }
  }

  const tokenToPay =
    selectedToken === "USDT"
      ? usdAmount.toFixed(2)
      : (selectedChain === "ETH" ? ethPay : bnbPay).toFixed(6);

  const tokenLabel =
    selectedToken === "USDT" ? "USDT" : chainCfg.nativeSymbol;

  return (
    <div
      style={{
        width: 380,
        padding: 24,
        borderRadius: 28,
        background:
          "radial-gradient(circle at top, rgba(220,252,231,0.12), transparent 55%) #020617",
        border: "1px solid rgba(148,163,184,0.5)",
        boxShadow: "0 0 40px rgba(15,23,42,0.9)",
        color: "white",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <h3
        style={{
          textAlign: "center",
          margin: 0,
          fontSize: 18,
          opacity: 0.8,
        }}
      >
        Buy Now
      </h3>
      <h2
        style={{
          textAlign: "center",
          margin: "4px 0 14px",
          fontSize: 22,
          fontWeight: 800,
          color: "#facc15",
        }}
      >
        Before Price Rises
      </h2>

      {/* progress */}
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            height: 12,
            borderRadius: 999,
            background: "rgba(15,23,42,0.9)",
            overflow: "hidden",
            border: "1px solid rgba(250,250,210,0.8)",
          }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: "100%",
              background:
                "linear-gradient(90deg,#e5ff00,#a3e635,#22c55e)",
              transition: "width 0.3s ease-out",
            }}
          />
        </div>
        <div
          style={{
            marginTop: 4,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            opacity: 0.85,
          }}
        >
          <span>Presale progress</span>
          <span>{progressPercent.toFixed(2)}% Sold</span>
        </div>
      </div>

      {/* price */}
      <div
        style={{
          marginTop: 4,
          marginBottom: 12,
          padding: "8px 10px",
          borderRadius: 14,
          background: "rgba(15,23,42,0.95)",
          fontSize: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>1 TWE = ${currentPrice || "0.000"}</span>
        <span style={{ opacity: 0.7 }}>Next price: soon</span>
      </div>

      {/* chain buttons */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 8,
          fontSize: 11,
        }}
      >
        {(["ETH", "BSC"] as const).map((ch) => {
          const cfg = ch === "ETH" ? CHAINS.ETH : CHAINS.BSC;
          const isActive = selectedChain === ch;
          return (
            <button
              key={ch}
              onClick={() => setSelectedChain(ch)}
              style={{
                flex: 1,
                padding: "6px 8px",
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.6)",
                background: isActive
                  ? "linear-gradient(90deg,#22c55e,#a3e635)"
                  : "rgba(15,23,42,0.9)",
                color: isActive
                  ? "#020617"
                  : "rgba(226,232,240,0.9)",
                cursor: "pointer",
              }}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* token buttons */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 10,
          fontSize: 11,
        }}
      >
        {(["NATIVE", "USDT"] as const).map((tok) => {
          const isActive = selectedToken === tok;
          const label =
            tok === "USDT" ? "USDT" : chainCfg.nativeSymbol;
          return (
            <button
              key={tok}
              onClick={() => setSelectedToken(tok)}
              style={{
                flex: 1,
                padding: "6px 8px",
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.6)",
                background: isActive
                  ? "linear-gradient(90deg,#22c55e,#a3e635)"
                  : "rgba(15,23,42,0.9)",
                color: isActive
                  ? "#020617"
                  : "rgba(226,232,240,0.9)",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* amount */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, opacity: 0.8 }}>
          Amount in USD
        </label>
        <input
          type="number"
          min={MIN_USD}
          value={usdAmount}
          onChange={(e) =>
            setUsdAmount(
              Math.max(MIN_USD, Number(e.target.value) || MIN_USD)
            )
          }
          style={{
            marginTop: 4,
            width: "100%",
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid rgba(55,65,81,0.9)",
            background: "rgba(15,23,42,0.96)",
            color: "white",
            fontSize: 13,
          }}
        />
        <div
          style={{
            fontSize: 10,
            opacity: 0.7,
            marginTop: 2,
          }}
        >
          Minimum: ${MIN_USD}. Gas is paid separately in your wallet.
        </div>
      </div>

      {/* summary */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
          fontSize: 11,
        }}
      >
        <div
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 10,
            background: "rgba(15,23,42,0.95)",
            border: "1px solid rgba(148,163,184,0.5)",
          }}
        >
          <div style={{ opacity: 0.75 }}>
            {tokenLabel} you pay
          </div>
          <div style={{ fontSize: 14, marginTop: 4 }}>
            {tokenToPay}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 10,
            background: "rgba(15,23,42,0.95)",
            border: "1px solid rgba(148,163,184,0.5)",
          }}
        >
          <div style={{ opacity: 0.75 }}>TWE you receive</div>
          <div style={{ fontSize: 14, marginTop: 4 }}>
            {tweForUsd.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={handlePay}
        disabled={
          isPaying ||
          isTxPending ||
          isWritePending ||
          usdAmount < MIN_USD
        }
        style={{
          width: "100%",
          padding: "10px 14px",
          borderRadius: 999,
          border: "none",
          background:
            "linear-gradient(90deg,#22c55e,#a3e635)",
          color: "#020617",
          fontWeight: 700,
          fontSize: 13,
          cursor:
            isPaying ||
            isTxPending ||
            isWritePending ||
            usdAmount < MIN_USD
              ? "not-allowed"
              : "pointer",
          opacity:
            isPaying ||
            isTxPending ||
            isWritePending ||
            usdAmount < MIN_USD
              ? 0.55
              : 1,
        }}
      >
        {isConnected ? "Pay" : "Connect Wallet & Pay"}
      </button>

      {payError && (
        <div
          style={{
            marginTop: 6,
            fontSize: 10,
            color: "#f97373",
          }}
        >
          {payError}
        </div>
      )}
      {paySuccess && (
        <div
          style={{
            marginTop: 6,
            fontSize: 10,
            color: "#4ade80",
            wordBreak: "break-all",
          }}
        >
          {paySuccess}
        </div>
      )}
    </div>
  );
}