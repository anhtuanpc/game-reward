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
  getOrCreateAssociatedTokenAccount,
  getAccount,
} from "@solana/spl-token";
import fs from "fs";
import bs58 from "bs58";

// Claim rewards script for Game Reward contract
async function claimRewards() {
  console.log("🎁 Claiming Rewards from Game Reward Contract");
  console.log("=============================================");

  try {
    // Connect to devnet
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

    // Load user's private key from file
    const privateKeyPath = "./scripts/private.txt";

    if (!fs.existsSync(privateKeyPath)) {
      throw new Error(`❌ Private key file not found at ${privateKeyPath}`);
    }

    // Read private key from file
    const privateKeyContent = fs.readFileSync(privateKeyPath, "utf-8").trim();

    let userKeypair: Keypair;

    try {
      // Try parsing as JSON array first
      const privateKeyArray = JSON.parse(privateKeyContent);
      if (Array.isArray(privateKeyArray) && privateKeyArray.length === 64) {
        userKeypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
      } else {
        throw new Error("Invalid array length or format");
      }
    } catch (jsonError) {
      try {
        // Try parsing as base58 string
        const decoded = bs58.decode(privateKeyContent);
        if (decoded.length === 64) {
          userKeypair = Keypair.fromSecretKey(decoded);
        } else {
          throw new Error("Invalid base58 key length");
        }
      } catch (bs58Error) {
        throw new Error(
          "❌ Invalid private key format. Expected JSON array [1,2,3...] or base58 string. " +
            `JSON error: ${jsonError.message}, Base58 error: ${bs58Error.message}`
        );
      }
    }

    console.log("👤 User wallet:", userKeypair.publicKey.toString());

    // Load deployment info
    const deploymentInfoPath = "./deployment-info.json";
    if (!fs.existsSync(deploymentInfoPath)) {
      throw new Error(
        "❌ deployment-info.json not found. Please run initialization first."
      );
    }

    const deploymentInfo = JSON.parse(
      fs.readFileSync(deploymentInfoPath, "utf-8")
    );
    const programId = new PublicKey(deploymentInfo.programId);
    const mint = new PublicKey(deploymentInfo.mint);

    console.log("📋 Program ID:", programId.toString());
    console.log("🪙 Token Mint:", mint.toString());

    // Setup provider and program
    const adminWalletPath =
      process.env.ANCHOR_WALLET || `${process.env.HOME}/.config/solana/id.json`;
    const adminKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync(adminWalletPath, "utf-8")))
    );
    const adminWallet = new anchor.Wallet(adminKeypair);

    const provider = new anchor.AnchorProvider(connection, adminWallet, {
      commitment: "confirmed",
    });
    anchor.setProvider(provider);

    const program = anchor.workspace.gameReward as Program<GameReward>;

    // Get PDAs
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );

    const [userScorePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user"), userKeypair.publicKey.toBuffer()],
      program.programId
    );

    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId
    );

    const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId
    );

    // Check current user score and eligibility
    console.log("\n📊 Checking eligibility...");

    try {
      const userScore = await program.account.userScore.fetch(userScorePda);
      const config = await program.account.config.fetch(configPda);

      console.log("Current points:", userScore.points.toString());
      console.log("Points needed:", config.pointsToClaim.toString());
      console.log("Has claimed:", userScore.claimed);

      if (userScore.points.lt(config.pointsToClaim)) {
        const pointsNeeded = config.pointsToClaim.sub(userScore.points);
        throw new Error(
          `❌ Not enough points! You need ${pointsNeeded.toString()} more points.`
        );
      }

      if (userScore.claimed) {
        console.log("⚠️ You have already claimed your rewards!");
        return;
      }
    } catch (error) {
      if (error.message.includes("Account does not exist")) {
        throw new Error(
          "❌ User hasn't checked in yet! Please check in first."
        );
      }
      throw error;
    }

    // Create user's token account
    console.log("\n🏦 Setting up user token account...");
    const userAta = await getOrCreateAssociatedTokenAccount(
      connection,
      adminKeypair, // Admin pays for ATA creation
      mint,
      userKeypair.publicKey
    );

    console.log("✅ User ATA:", userAta.address.toString());

    // Check user's current token balance
    const userTokenBalanceBefore = await getAccount(
      connection,
      userAta.address
    );
    console.log(
      "💰 Current token balance:",
      userTokenBalanceBefore.amount.toString()
    );

    // Perform claim
    console.log("\n🎁 Claiming rewards...");

    try {
      const txId = await program.methods
        .claim()
        .accountsPartial({
          userScore: userScorePda,
          user: userKeypair.publicKey,
          config: configPda,
          userAta: userAta.address,
          vault: vaultPda,
          vaultAuthority: vaultAuthorityPda,
          mint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([userKeypair])
        .rpc();

      console.log("✅ Claim successful!");
      console.log(
        "📝 Transaction:",
        `https://explorer.solana.com/tx/${txId}?cluster=devnet`
      );

      // Check updated balances
      const userTokenBalanceAfter = await getAccount(
        connection,
        userAta.address
      );
      const updatedScore = await program.account.userScore.fetch(userScorePda);

      const tokensReceived = Number(
        userTokenBalanceAfter.amount - userTokenBalanceBefore.amount
      );

      console.log("\n🎉 Claim Results:");
      console.log("   Tokens received:", tokensReceived.toLocaleString());
      console.log(
        "   New token balance:",
        userTokenBalanceAfter.amount.toString()
      );
      console.log("   Remaining points:", updatedScore.points.toString());
      console.log(
        "   Claim status:",
        updatedScore.claimed ? "✅ Claimed" : "❌ Not claimed"
      );
    } catch (error) {
      if (error.message.includes("NotEnoughPoints")) {
        console.log("❌ Not enough points to claim rewards!");
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error("❌ Claim failed:", error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  claimRewards()
    .then(() => {
      console.log("\n✅ Claim script completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Claim script failed:", error.message);
      process.exit(1);
    });
}

export default claimRewards;
