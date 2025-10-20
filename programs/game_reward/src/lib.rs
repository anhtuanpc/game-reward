use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint};
pub mod instructions;
pub mod states;
pub mod errors;
pub mod constants;

declare_id!("9aTkaPCVPwJVP1rsps4GyBdCHeGTnQCtF6FHACocBwjZ");

#[program]
pub mod game_reward {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
