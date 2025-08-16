import {
  VaultCreated,
  VaultDeactivated,
  VaultReactivated,
  BotConfigUpdated
} from "../../generated/VaultFactory/VaultFactory";

import {
  Vault,
  Bot,
  Protocol
} from "../../generated/schema";

import {
  getOrCreateBot,
  getOrCreateVault,
  getOrCreateProtocol
} from "../utils/helpers";

import { BigInt, BigDecimal, log, DataSourceTemplate } from "@graphprotocol/graph-ts";

export function handleVaultCreated(event: VaultCreated): void {
  log.info("Vault created: botId={}, vault={}, botName={}", [
    event.params.botId.toString(),
    event.params.vault.toHexString(),
    event.params.botName
  ]);

  // Create or update bot
  let bot = getOrCreateBot(event.params.botId);
  bot.name = event.params.botName;
  bot.vault = event.params.vault.toHexString();
  bot.isActive = true;
  bot.save();

  // Create vault
  let vault = getOrCreateVault(event.params.vault);
  vault.bot = bot.id;
  vault.name = event.params.botName + " Vault";
  vault.isActive = true;
  vault.save();

  // Start indexing this vault using the template
  DataSourceTemplate.create("CrapsVault", [event.params.vault.toHexString()]);

  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.lastUpdated = event.block.timestamp;
  protocol.save();
}

export function handleVaultDeactivated(event: VaultDeactivated): void {
  log.info("Vault deactivated: botId={}", [
    event.params.botId.toString()
  ]);

  let bot = getOrCreateBot(event.params.botId);
  bot.isActive = false;
  bot.save();

  // Update vault if it exists
  if (bot.vault) {
    let vault = Vault.load(bot.vault);
    if (vault) {
      vault.isActive = false;
      vault.save();
    }
  }
}

export function handleVaultReactivated(event: VaultReactivated): void {
  log.info("Vault reactivated: botId={}", [
    event.params.botId.toString()
  ]);

  let bot = getOrCreateBot(event.params.botId);
  bot.isActive = true;
  bot.save();

  // Update vault if it exists
  if (bot.vault) {
    let vault = Vault.load(bot.vault);
    if (vault) {
      vault.isActive = true;
      vault.save();
    }
  }
}

export function handleBotConfigUpdated(event: BotConfigUpdated): void {
  log.info("Bot config updated: botId={}", [
    event.params.botId.toString()
  ]);

  let bot = getOrCreateBot(event.params.botId);
  
  // The config update doesn't provide specific details in the event
  // but we can mark the bot as recently updated
  bot.lastActiveBlock = event.block.number;
  bot.save();
}