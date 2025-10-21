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

// Check-in script for Game Reward contract
async function performCheckin() {
  console.log("✅ Performing Check-in on Game Reward Contract");
  console.log("===============================================");

  try {
    // Connect to devnet
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

    // Load user's private key from file
    const privateKeyPath = "./scripts/private.txt";

    if (!fs.existsSync(privateKeyPath)) {
      throw new Error(`❌ Private key file not found at ${privateKeyPath}`);
    }

    // Read private key from file (should be base58 encoded string or array of numbers)
    const privateKeyContent = fs.readFileSync(privateKeyPath, "utf-8").trim();

    let userKeypair: Keypair;

    try {
      // Try parsing as JSON array first (standard format)
      const privateKeyArray = JSON.parse(privateKeyContent);

      if (Array.isArray(privateKeyArray) && privateKeyArray.length === 64) {
        userKeypair = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
      } else {
        throw new Error(
          `Invalid array: isArray=${Array.isArray(privateKeyArray)}, length=${
            privateKeyArray.length
          }`
        );
      }
    } catch (jsonError) {
      try {
        // Try parsing as base58 string
        const decoded = bs58.decode(privateKeyContent);
        if (decoded.length === 64) {
          userKeypair = Keypair.fromSecretKey(decoded);
        } else {
          throw new Error(`Invalid base58 key length: ${decoded.length}`);
        }
      } catch (bs58Error) {
        throw new Error(
          "❌ Invalid private key format. Expected JSON array [1,2,3...] or base58 string. " +
            `JSON error: ${jsonError.message}, Base58 error: ${bs58Error.message}`
        );
      }
    }

    console.log("👤 User wallet:", userKeypair.publicKey.toString());

    // Check user balance and airdrop if needed
    const userBalance = await connection.getBalance(userKeypair.publicKey);
    console.log(
      "💰 User balance:",
      userBalance / anchor.web3.LAMPORTS_PER_SOL,
      "SOL"
    );

    if (userBalance < 0.01 * anchor.web3.LAMPORTS_PER_SOL) {
      console.log("💸 Requesting airdrop for user...");
      try {
        const signature = await connection.requestAirdrop(
          userKeypair.publicKey,
          1 * anchor.web3.LAMPORTS_PER_SOL
        );
        await connection.confirmTransaction(signature);
        console.log("✅ Airdrop completed!");
      } catch (error) {
        console.warn("⚠️ Airdrop failed, but continuing...");
      }
    }

    // Load deployment info to get program addresses
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

    console.log("📋 Program ID:", programId.toString());

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

    console.log("⚙️ Config PDA:", configPda.toString());
    console.log("📊 User Score PDA:", userScorePda.toString());

    // Check current user score before check-in
    try {
      const existingScore = await program.account.userScore.fetchNullable(
        userScorePda
      );
      if (existingScore) {
        console.log("\n📊 Current User Status:");
        console.log("   Points:", existingScore.points.toString());
        console.log(
          "   Last check-in:",
          new Date(
            existingScore.lastCheckinTs.toNumber() * 1000
          ).toLocaleString()
        );
        console.log("   Has claimed:", existingScore.claimed);
      } else {
        console.log("\n🆕 This is the user's first check-in!");
      }
    } catch (error) {
      console.log("📊 User hasn't checked in yet");
    }

    // Perform check-in
    console.log("\n🎯 Performing check-in...");

    try {
      const txId = await program.methods
        .checkIn()
        .accountsPartial({
          config: configPda,
          userScore: userScorePda,
          user: userKeypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([userKeypair])
        .rpc();

      console.log("✅ Check-in successful!");
      console.log(
        "📝 Transaction:",
        `https://explorer.solana.com/tx/${txId}?cluster=devnet`
      );

      // Fetch updated user score
      const updatedScore = await program.account.userScore.fetch(userScorePda);
      console.log("\n🎉 Updated User Status:");
      console.log("   Points:", updatedScore.points.toString());
      console.log(
        "   Last check-in:",
        new Date(updatedScore.lastCheckinTs.toNumber() * 1000).toLocaleString()
      );
      console.log("   Has claimed:", updatedScore.claimed);

      // Check if user can claim rewards
      const config = await program.account.config.fetch(configPda);
      const canClaim = updatedScore.points.gte(config.pointsToClaim);

      if (canClaim) {
        console.log(
          "\n🎁 Congratulations! You have enough points to claim rewards!"
        );
        console.log(`   Required points: ${config.pointsToClaim.toString()}`);
        console.log(`   Your points: ${updatedScore.points.toString()}`);
        console.log("   Use the claim script to get your rewards!");
      } else {
        const pointsNeeded = config.pointsToClaim.sub(updatedScore.points);
        console.log(
          `\n⏳ You need ${pointsNeeded.toString()} more points to claim rewards.`
        );
      }
    } catch (error) {
      if (error.message.includes("TooFrequentCheckIn")) {
        console.log(
          "⏰ Check-in too frequent! Please wait before checking in again."
        );

        // Show time until next check-in
        try {
          const userScore = await program.account.userScore.fetch(userScorePda);
          const config = await program.account.config.fetch(configPda);
          const lastCheckin = userScore.lastCheckinTs.toNumber();
          const interval = config.checkinIntervalSeconds.toNumber();
          const nextCheckin = lastCheckin + interval;
          const now = Math.floor(Date.now() / 1000);
          const waitTime = nextCheckin - now;

          if (waitTime > 0) {
            console.log(`⏱️ Next check-in available in: ${waitTime} seconds`);
            console.log(
              `⏱️ Next check-in time: ${new Date(
                nextCheckin * 1000
              ).toLocaleString()}`
            );
          } else {
            console.log("🤔 You should be able to check in now. Try again!");
          }
        } catch (timeError) {
          console.log("Unable to calculate next check-in time");
        }
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error("❌ Check-in failed:", error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  performCheckin()
    .then(() => {
      console.log("\n✅ Check-in script completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Check-in script failed:", error.message);
      process.exit(1);
    });
}

export default performCheckin;
