import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { GameReward } from "../target/types/game_reward";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";

const PREFIX_CONFIG = Buffer.from("config");
const PREFIX_USER = Buffer.from("user");
const PREFIX_VAULT = Buffer.from("vault");

// Helper function to wait between check-ins
async function waitForNextCheckin(seconds: number = 2) {
  console.log(`⏰ Waiting ${seconds} seconds for next check-in...`);
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

describe("game_reward", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.gameReward as Program<GameReward>;
  let admin = provider.wallet;
  let user = anchor.web3.Keypair.generate();
  let mint: PublicKey;
  let adminAta, vault, vaultAuthority, userAta;

  const POINTS_TO_CLAIM = new anchor.BN(3);
  const REWARD_AMOUNT = new anchor.BN(10_000_000); // 10 tokens if decimals=6
  const CHECKIN_INTERVAL = new anchor.BN(0); // Set to 0 seconds for testing

  it("Initialize config", async () => {
    const [configPda] = PublicKey.findProgramAddressSync(
      [PREFIX_CONFIG],
      program.programId
    );

    await program.methods
      .initializeConfig(POINTS_TO_CLAIM, REWARD_AMOUNT, CHECKIN_INTERVAL)
      .accountsPartial({
        config: configPda,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const cfg = await program.account.config.fetch(configPda);
    console.log("Config set:", cfg);
  });

  it("Create mock token mint and fund vault", async () => {
    mint = await createMint(
      provider.connection,
      admin.payer,
      admin.publicKey,
      null,
      6
    );
    console.log("Mint:", mint.toBase58());

    adminAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      mint,
      admin.publicKey
    );

    await mintTo(
      provider.connection,
      admin.payer,
      mint,
      adminAta.address,
      admin.payer,
      1_000_000_000
    );

    // Get the vault authority PDA (for authority)
    const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
      [PREFIX_VAULT],
      program.programId
    );
    vaultAuthority = vaultAuthorityPda;

    // Get the vault PDA (for the token account) - same seeds as authority in this case
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [PREFIX_VAULT],
      program.programId
    );

    await program.methods
      .fundVault(new anchor.BN(500_000_000))
      .accountsPartial({
        admin: admin.publicKey,
        adminAta: adminAta.address,
        vault: vaultPda, // Use the vault PDA address
        vaultAuthority: vaultAuthorityPda, // Use the authority PDA
        mint,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    // Store the vault for future use
    vault = { address: vaultPda };

    const vaultAcc = await getAccount(provider.connection, vaultPda);
    console.log("Vault balance:", vaultAcc.amount.toString());
  });

  it("User check-in multiple times then claim reward", async () => {
    await provider.connection.requestAirdrop(
      user.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );

    const [configPda] = PublicKey.findProgramAddressSync(
      [PREFIX_CONFIG],
      program.programId
    );
    const [userScorePda] = PublicKey.findProgramAddressSync(
      [PREFIX_USER, user.publicKey.toBuffer()],
      program.programId
    );

    userAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      admin.payer,
      mint,
      user.publicKey
    );

    for (let i = 0; i < 3; i++) {
      await program.methods
        .checkIn()
        .accountsPartial({
          config: configPda,
          userScore: userScorePda,
          user: user.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      console.log(`User check-in #${i + 1}`);

      // Wait for the checkin interval if not the last iteration
      if (i < 2) {
        await waitForNextCheckin(1); // Wait 1 second (> 0 second interval)
      }
    }

    const score = await program.account.userScore.fetch(userScorePda);
    console.log("User score:", score.points.toString());

    await program.methods
      .claim()
      .accountsPartial({
        userScore: userScorePda,
        user: user.publicKey,
        config: configPda,
        userAta: userAta.address,
        vault: vault.address,
        vaultAuthority,
        mint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    const userAcc = await getAccount(provider.connection, userAta.address);
    console.log("User ATA balance after claim:", userAcc.amount.toString());
  });
});
