import { createWalletClient, custom, parseEther, createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { toMetaMaskSmartAccount, Implementation, createDelegation, ScopeType } from "@metamask/smart-accounts-kit";

/**
 * Helper to request a session key delegation using Smart Accounts Kit
 * @param spendLimit USDC limit in dollars (as string/number)
 * @param expiryDays Number of days the session is valid
 * @param chainId Target network
 */
export async function grantAgentPermissions(spendLimit: number, expiryDays: number, chainId: number) {
  if (!window.ethereum) throw new Error("MetaMask is not installed.");

  // The agent's address
  const agentAddress = "0xAgent000000000000000000000000000000000001"; // NEEDS CONFIRMATION

  const publicClient = createPublicClient({
    chain: chainId === 84532 ? baseSepolia : baseSepolia,
    transport: http()
  });

  const walletClient = createWalletClient({
    chain: chainId === 84532 ? baseSepolia : baseSepolia,
    transport: custom(window.ethereum)
  });

  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error("No account connected");

  console.log("[SmartAccountKit] Initializing Hybrid Smart Account...");
  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Hybrid,
    deployParams: [account, [], [], []],
    deploySalt: '0x',
    signer: { walletClient }
  });
  console.log("[SmartAccountKit] Initialized Smart Account Address:", smartAccount.address);

  // We create a delegation for an arbitrary contract call or ERC20 transfer
  // Let's use Erc20TransferAmount as an example matching the spendLimit
  // USDC address on Base Sepolia as placeholder
  const tokenAddress = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // NEEDS CONFIRMATION

  const delegation = createDelegation({
    to: agentAddress,
    from: smartAccount.address,
    environment: smartAccount.environment,
    scope: {
      type: ScopeType.Erc20TransferAmount,
      tokenAddress,
      maxAmount: parseEther(spendLimit.toString()),
    },
  });

  console.log("[SmartAccountKit] Requesting User Signature for Delegation...");
  
  try {
    const signature = await smartAccount.signDelegation({
      delegation
    });
    
    const signedDelegation = {
      ...delegation,
      signature,
    };
    
    console.log("[SmartAccountKit] Delegation successfully signed!", signedDelegation);
    
    return {
      mocked: false,
      grantedAt: Date.now(),
      spendLimit,
      expiryDays,
      delegation: signedDelegation
    };
  } catch (error: any) {
    console.error("Delegation signing failed:", error);
    throw error;
  }
}
