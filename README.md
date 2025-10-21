# Game Reward System

A Solana-based game reward system built with Anchor framework that allows users to check in daily and claim token rewards based on accumulated points.

## Features

- **Daily Check-ins**: Users can check in to earn points (with configurable time intervals)
- **Point-based Rewards**: Users accumulate points and can claim token rewards when they have enough points
- **Admin Controls**: Configurable reward amounts, point requirements, and check-in intervals
- **Secure Vault System**: PDA-based token vault for secure reward distribution

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v16 or higher)
- [Rust](https://rustup.rs/)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- [Anchor Framework](https://www.anchor-lang.com/docs/installation)
- [Git](https://git-scm.com/)

### Verify Installation

```bash
# Check versions
node --version
rustc --version
solana --version
anchor --version
```

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/anhtuanpc/game-reward.git
cd game-reward
```

### 2. Install Dependencies

```bash
# Install Node.js dependencies
npm install
# or
yarn install
```

### 3. Configure Solana Environment

```bash
# Set Solana to use local cluster for development
solana config set --url localhost

# Generate a new keypair if you don't have one
solana-keygen new

# Check your configuration
solana config get
```

### 4. Sync Anchor Keys

This step is crucial to ensure your local keypair matches the program ID in the Anchor configuration:

```bash
# Generate and sync new program keypair with Anchor
anchor keys sync

# This will update:
# - Anchor.toml with your program ID
# - lib.rs declare_id! macro
# - Your local keypair files
```

### 5. Start Local Validator

Open a new terminal and start the Solana test validator:

```bash
# Start local validator (keep this running)
solana-test-validator

# In another terminal, check if it's running
solana cluster-version
```

### 6. Build and Deploy

```bash
# Build the program
anchor build

# Deploy to local cluster
anchor deploy

# Check deployment
solana program show <PROGRAM_ID>
```

## Running Tests

### Quick Test Run

```bash
# Run all tests
anchor test

# Run tests with detailed output
anchor test --skip-local-validator
```

### Manual Testing Steps

If you prefer to run tests manually:

```bash
# 1. Start local validator (if not already running)
solana-test-validator

# 2. Build and deploy
anchor build && anchor deploy

# 3. Run the test suite
npm test
# or
yarn test
```

### Test Coverage

The test suite includes:

- ✅ **Config Initialization**: Setting up admin, point requirements, and reward amounts
- ✅ **Token Setup**: Creating mock tokens and funding the vault
- ✅ **User Check-ins**: Multiple check-ins with time interval validation
- ✅ **Reward Claims**: Users claiming token rewards after accumulating points

### Test Configuration

For faster testing, the test suite uses:

- `CHECKIN_INTERVAL = 0` (no wait time between check-ins)
- `POINTS_TO_CLAIM = 3` (need 3 points to claim)
- `REWARD_AMOUNT = 10,000,000` (10 tokens with 6 decimals)

## Project Structure

```
├── programs/
│   └── game_reward/
│       └── src/
│           ├── lib.rs                 # Main program entry
│           ├── instructions/          # Program instructions
│           │   ├── initialize_config.rs
│           │   ├── check_in.rs
│           │   ├── claim.rs
│           │   └── mock_token.rs
│           ├── states/               # Account structures
│           │   ├── config.rs
│           │   └── user_score.rs
│           ├── errors.rs            # Custom error definitions
│           └── constants.rs         # Program constants
├── tests/
│   └── game_reward.ts              # Test suite
├── target/                         # Build artifacts
├── Anchor.toml                     # Anchor configuration
└── package.json                    # Node.js dependencies
```

## Program Instructions

### 1. `initialize_config`

Initialize the global configuration for the game reward system.

**Parameters:**

- `points_to_claim: u64` - Points needed to claim rewards
- `reward_amount: u64` - Token amount per claim
- `checkin_interval_seconds: u64` - Minimum seconds between check-ins

### 2. `check_in`

Allow users to check in and earn points.

**Features:**

- Creates user score account on first check-in
- Enforces rate limiting based on configured interval
- Emits check-in events

### 3. `claim`

Allow users to claim token rewards using their accumulated points.

**Requirements:**

- User must have enough points
- Valid vault with sufficient token balance
- Proper token account setup

### 4. `fund_vault` (Testing)

Fund the reward vault with tokens for testing purposes.

## Troubleshooting

### Common Issues

1. **Program ID Mismatch**

   ```bash
   # Re-sync keys if you get program ID errors
   anchor keys sync
   anchor build
   anchor deploy
   ```

2. **Local Validator Issues**

   ```bash
   # Reset local validator
   solana-test-validator --reset
   ```

3. **Insufficient SOL**

   ```bash
   # Airdrop SOL for testing
   solana airdrop 5
   ```

4. **Test Failures**
   ```bash
   # Clean build and retry
   anchor clean
   anchor build
   anchor test
   ```

### Key Sync Issues

If `anchor keys sync` fails or you need to manually sync:

1. Generate new keypair:

   ```bash
   solana-keygen new -o target/deploy/game_reward-keypair.json --force
   ```

2. Get the program ID:

   ```bash
   solana-keygen pubkey target/deploy/game_reward-keypair.json
   ```

3. Update `Anchor.toml`:

   ```toml
   [programs.localnet]
   game_reward = "YOUR_NEW_PROGRAM_ID"
   ```

4. Update `lib.rs`:
   ```rust
   declare_id!("YOUR_NEW_PROGRAM_ID");
   ```

## Development

### Adding New Features

1. Create new instruction files in `programs/game_reward/src/instructions/`
2. Add the instruction to `mod.rs` and `lib.rs`
3. Write tests in `tests/game_reward.ts`
4. Build and test: `anchor build && anchor test`

### Environment Variables

Create `.env` file for custom configurations:

```bash
ANCHOR_PROVIDER_URL=http://localhost:8899
ANCHOR_WALLET=~/.config/solana/id.json
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes and add tests
4. Run the test suite: `anchor test`
5. Commit your changes: `git commit -m "Add new feature"`
6. Push to the branch: `git push origin feature/new-feature`
7. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

If you encounter any issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review the [Anchor Documentation](https://www.anchor-lang.com/)
3. Open an issue on GitHub with detailed error messages and steps to reproduce

---

**Happy Building! 🚀**
