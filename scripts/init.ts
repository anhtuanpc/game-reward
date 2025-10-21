import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { GameReward } from "../target/types/game_reward";
import {
  PublicKey,
  SystemProgram,
  Keypair,
  Connection,
  clusterApiUrl,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import fs from "fs";

// Simple initialization script for Game Reward contract
async function initializeContract() {
  console.log("🚀 Initializing Game Reward Contract on Devnet");
  console.log("==============================================");

  // Connect to devnet
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  // Load your wallet
  const walletPath =
    process.env.ANCHOR_WALLET || `${process.env.HOME}/.config/solana/id.json`;
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );
  const wallet = new anchor.Wallet(walletKeypair);

  // Setup provider and program
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const program = anchor.workspace.gameReward as Program<GameReward>;

  console.log("👛 Admin wallet:", wallet.publicKey.toString());
  console.log("📋 Program ID:", program.programId.toString());

  // Check balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("💰 Balance:", balance / anchor.web3.LAMPORTS_PER_SOL, "SOL");

  try {
    // Step 1: Initialize Config
    console.log("\n1️⃣ Initializing config...");
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );

    // Check if config already exists
    const existingConfig = await program.account.config.fetchNullable(
      configPda
    );
    if (existingConfig) {
      console.log("✅ Config already exists");
      console.log(
        "   Points to claim:",
        existingConfig.pointsToClaim.toString()
      );
      console.log("   Reward amount:", existingConfig.rewardAmount.toString());
    } else {
      const pointsToClaim = new anchor.BN(3); // 3 points needed
      const rewardAmount = new anchor.BN(1_000_000); // 1 token (6 decimals)
      const checkinInterval = new anchor.BN(60); // 1 minute

      await program.methods
        .initializeConfig(pointsToClaim, rewardAmount, checkinInterval)
        .accountsPartial({
          config: configPda,
          admin: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("✅ Config initialized!");
      console.log("   Config PDA:", configPda.toString());
    }

    // Step 2: Create Token Mint
    console.log("\n2️⃣ Creating reward token...");
    const mint = await createMint(
      connection,
      wallet.payer,
      wallet.publicKey, // mint authority
      wallet.publicKey, // freeze authority
      6 // decimals
    );

    console.log("✅ Token created!");
    console.log("   Mint address:", mint.toString());

    // Step 3: Mint tokens to admin
    console.log("\n3️⃣ Minting tokens to admin...");
    const adminAta = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet.payer,
      mint,
      wallet.publicKey
    );

    await mintTo(
      connection,
      wallet.payer,
      mint,
      adminAta.address,
      wallet.payer,
      2_000_000_000 // 2000 tokens
    );

    console.log("✅ Tokens minted to admin!");
    console.log("   Admin ATA:", adminAta.address.toString());

    // Step 4: Fund Vault
    console.log("\n4️⃣ Setting up and funding vault...");
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId
    );

    const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId
    );

    const vaultFunding = new anchor.BN(1_000_000_000); // 1000 tokens

    await program.methods
      .fundVault(vaultFunding)
      .accountsPartial({
        admin: wallet.publicKey,
        adminAta: adminAta.address,
        vault: vaultPda,
        vaultAuthority: vaultAuthorityPda,
        mint,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    console.log("✅ Vault funded!");
    console.log("   Vault PDA:", vaultPda.toString());

    // Step 5: Save deployment info
    console.log("\n5️⃣ Saving deployment info...");
    const deploymentInfo = {
      timestamp: new Date().toISOString(),
      cluster: "devnet",
      programId: program.programId.toString(),
      admin: wallet.publicKey.toString(),
      configPda: configPda.toString(),
      mint: mint.toString(),
      adminAta: adminAta.address.toString(),
      vaultPda: vaultPda.toString(),
      vaultAuthority: vaultAuthorityPda.toString(),
      explorerLinks: {
        program: `https://explorer.solana.com/address/${program.programId.toString()}?cluster=devnet`,
        config: `https://explorer.solana.com/address/${configPda.toString()}?cluster=devnet`,
        mint: `https://explorer.solana.com/address/${mint.toString()}?cluster=devnet`,
        vault: `https://explorer.solana.com/address/${vaultPda.toString()}?cluster=devnet`,
      },
    };

    fs.writeFileSync(
      "deployment-info.json",
      JSON.stringify(deploymentInfo, null, 2)
    );

    console.log("✅ Deployment info saved to deployment-info.json");

    // Success summary
    console.log("\n🎉 Contract initialization completed successfully!");
    console.log("\n📋 Summary:");
    console.log("   Program ID:", program.programId.toString());
    console.log("   Config PDA:", configPda.toString());
    console.log("   Token Mint:", mint.toString());
    console.log("   Vault PDA:", vaultPda.toString());
    console.log("\n🔗 Explorer Links:");
    console.log(
      "   Program:",
      `https://explorer.solana.com/address/${program.programId.toString()}?cluster=devnet`
    );
    console.log(
      "   Token:",
      `https://explorer.solana.com/address/${mint.toString()}?cluster=devnet`
    );

    console.log("\n✨ Your contract is ready! Users can now:");
    console.log("   • Check in to earn points");
    console.log("   • Claim rewards when they have 5+ points");
  } catch (error) {
    console.error("❌ Initialization failed:", error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  initializeContract()
    .then(() => {
      console.log("\n✅ Script completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Script failed:", error.message);
      process.exit(1);
    });
}

export default initializeContract;
