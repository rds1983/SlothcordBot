import { Client, GatewayIntentBits, Message, TextChannel } from "discord.js";
import { AlertsProcessor } from "./AlertsProcessor";
import { EmporiumProcessor } from "./EmporiumProcessor";
import { EpicsProcessor } from "./EpicsProcessor";
import { ForumProcessor } from "./ForumProcessor";
import { Global } from "./Global";
import { GroupsProcessor } from "./GroupsProcessor";
import { EpicHistoryEventType, PeriodType, Statistics } from "./Statistics";
import { LoggerWrapper } from "./LoggerWrapper";
import { BaseProcessor } from "./BaseProcessor";
import { Utility } from "./Utility";

Global.config = require('./config.json');
Global.usersToCharacters = require('./usersToCharacters.json');

let s = Global.usersToCharacters;

export class Main {
	private readonly RatingMaximum: number = 10;

	private readonly loggerWrapper: LoggerWrapper = new LoggerWrapper("main");

	public groupsProcessor: GroupsProcessor;
	public epicsProcessor: EpicsProcessor;
	public emporiumProcessor: EmporiumProcessor;
	public forumProcessor: ForumProcessor;
	public alertsProcessor: AlertsProcessor;
	private client: Client;

	public static instance: Main;

	logError(message: any): void {
		this.loggerWrapper.logError(message);
	}

	logInfo(message: any): void {
		this.loggerWrapper.logInfo(message);
	}

	async fetchTopDeathsAsync(channel: TextChannel, period: PeriodType): Promise<void> {
		let topDeaths = await Statistics.fetchTopDeaths(period);

		let message = `Top deaths rating from ${Utility.formatOnlyDate(topDeaths.start)} to ${Utility.formatOnlyDate(topDeaths.end)}.\n\n`;

		for (let i = 0; i < topDeaths.players.length && i < this.RatingMaximum; ++i) {
			let pd = topDeaths.players[i];
			let raiseRate = Math.round(pd.raises * 100.0 / pd.count);
			message += `${i + 1}. ${pd.name} died ${pd.count} times. Was raised ${pd.raises} times (${raiseRate}%).\n`;
		}

		this.logInfo(message);
		Utility.sendMessage(channel, message);
	}

	fetchTopDeaths(channel: TextChannel, period: PeriodType): void {
		this.fetchTopDeathsAsync(channel, period).catch(err => this.logError(err));
	}

	async fetchMostDeadlyAsync(channel: TextChannel, period: PeriodType): Promise<void> {
		let mostDeadly = await Statistics.fetchMostDeadly(period);

		let message = `Most deadly rating from ${Utility.formatOnlyDate(mostDeadly.start)} to ${Utility.formatOnlyDate(mostDeadly.end)}.\n\n`;

		for (let i = 0; i < mostDeadly.deadlies.length && i < this.RatingMaximum; ++i) {
			let d = mostDeadly.deadlies[i];
			let raiseRate = Math.round(d.raises * 100.0 / d.count);
			message += `${i + 1}. ${d.name} killed ${d.count} times. Raised ${d.raises} times (${raiseRate}%).\n`;
		}

		this.logInfo(message);
		Utility.sendMessage(channel, message);
	}

	fetchMostDeadly(channel: TextChannel, period: PeriodType): void {
		this.fetchMostDeadlyAsync(channel, period).catch(err => this.logError(err));
	}

	async fetchMostDeadlyForAsync(channel: TextChannel, character: string): Promise<void> {
		let mostDeadly = await Statistics.fetchMostDeadlyFor(character);

		let message = `Most deadly rating for ${character} from ${Utility.formatOnlyDate(mostDeadly.start)} to ${Utility.formatOnlyDate(mostDeadly.end)}.\n\n`;

		for (let i = 0; i < mostDeadly.deadlies.length && i < this.RatingMaximum; ++i) {
			let d = mostDeadly.deadlies[i];
			message += `${i + 1}. ${d.name} killed you ${d.count} times.\n`;
		}

		this.logInfo(message);
		Utility.sendMessage(channel, message);
	}

	fetchMostDeadlyFor(channel: TextChannel, character: string): void {
		this.fetchMostDeadlyForAsync(channel, character).catch(err => this.logError(err));
	}

	async fetchVictimsOfAsync(channel: TextChannel, name: string): Promise<void> {
		let victimsOf = await Statistics.fetchVictimsOf(name);

		let message = "";
		if (victimsOf == null) {
			message = `Unable to find mobile with name '${name}'`;
		} else {

			message = `Victims of rating for '${victimsOf.name}' from ${Utility.formatOnlyDate(victimsOf.start)} to ${Utility.formatOnlyDate(victimsOf.end)}.\n\n`;

			for (let i = 0; i < victimsOf.deadlies.length && i < this.RatingMaximum; ++i) {
				let d = victimsOf.deadlies[i];
				message += `${i + 1}. Killed ${d.name} ${d.count} times.\n`;
			}
		}

		this.logInfo(message);
		Utility.sendMessage(channel, message);
	}

	fetchVictimsOf(channel: TextChannel, name: string): void {
		this.fetchVictimsOfAsync(channel, name).catch(err => this.logError(err));
	}

	async fetchEpicHistoryAsync(channel: TextChannel, name: string): Promise<void> {
		let EpicHistory = await Statistics.fetchEpicHistory(name);

		let message = "";
		if (EpicHistory == null) {
			message = `Unable to find epic with name '${name}'`;
		} else {
			message = `Epic history for '${EpicHistory.name}'.\n\n`;

			for (let i = 0; i < EpicHistory.history.length; ++i) {
				let d = EpicHistory.history[i];

				message += `${Utility.formatDateTime(d.timeStamp)}: `;

				if (d.eventType == EpicHistoryEventType.Appeared)
				{
					message += `Appeared\n`;
				} else if (d.leader == null)
				{
					message += `Disappeared\n`;
				} else
				{
					message += `Defeated by ${d.leader}'s group\n`;
				}
			}
		}

		this.logInfo(message);
		Utility.sendMessage(channel, message);
	}

	fetchEpicHistory(channel: TextChannel, name: string): void {
		this.fetchEpicHistoryAsync(channel, name).catch(err => this.logError(err));
	}	

	async fetchStatForAsync(channel: TextChannel, character: string): Promise<void> {
		let mostDeadly = await Statistics.fetchStatFor(character);

		let message = `Statistics for ${character} from ${Utility.formatOnlyDate(mostDeadly.start)} to ${Utility.formatOnlyDate(mostDeadly.end)}.\n\n`;

		message += `You died ${mostDeadly.deathsCount} times.\n`;
		message += `You were raised ${mostDeadly.wereRaisedCount} times.\n`;
		message += `You raised someone ${mostDeadly.raisedSomeoneCount} times.\n`;
		message += `You sold ${mostDeadly.salesCount} items for ${mostDeadly.salesSum} gold coins at the auction.\n`;

		this.logInfo(message);
		Utility.sendMessage(channel, message);
	}

	fetchStatFor(channel: TextChannel, character: string): void {
		this.fetchStatForAsync(channel, character).catch(err => this.logError(err));
	}

	async fetchTopRaisersAsync(channel: TextChannel, period: PeriodType): Promise<void> {
		let topRaisers = await Statistics.fetchTopRaisers(period);

		let message = `Top raisers rating from ${Utility.formatOnlyDate(topRaisers.start)} to ${Utility.formatOnlyDate(topRaisers.end)}.\n\n`;

		for (let i = 0; i < topRaisers.raisers.length && i < this.RatingMaximum; ++i) {
			let d = topRaisers.raisers[i];
			message += `${i + 1}. ${d.name} raised ${d.count} times.\n`;
		}

		this.logInfo(message);
		Utility.sendMessage(channel, message);
	}

	fetchTopRaisers(channel: TextChannel, period: PeriodType): void {
		this.fetchTopRaisersAsync(channel, period).catch(err => this.logError(err));
	}

	async fetchBestLeadersAsync(channel: TextChannel): Promise<void> {
		let bestLeaders = await Statistics.fetchBestLeaders();

		let message = `Best leaders rating from ${Utility.formatOnlyDate(bestLeaders.start)} to ${Utility.formatOnlyDate(bestLeaders.end)}.\n\n`;

		for (let i = 0; i < bestLeaders.leaders.length && i < this.RatingMaximum; ++i) {
			let d = bestLeaders.leaders[i];
			let roundedSize = Math.round(d.totalSize / d.groupsCount);

			message += `${i + 1}. ${d.name} led ${d.realGroupsCount} groups. Average group size was ${roundedSize}. Overall score is ${Utility.formatNumber(d.score)}.\n`;
		}

		this.logInfo(message);
		Utility.sendMessage(channel, message);
	}

	fetchBestLeaders(channel: TextChannel): void {
		this.fetchBestLeadersAsync(channel).catch(err => this.logError(err));
	}

	async fetchGameStatsAsync(channel: TextChannel, period: PeriodType): Promise<void> {
		let gameStats = await Statistics.fetchGameStats(period);

		let message = `Game statistics from ${Utility.formatOnlyDate(gameStats.start)} to ${Utility.formatOnlyDate(gameStats.end)}.\n\n`;
		message += `${gameStats.adventurersDiedCount} different adventurers were slain by ${gameStats.deadlyCount} different creatures ${gameStats.adventurersDeathsCount} times.\n`;
		message += `${gameStats.adventurersRaisedCount} different adventurers were raised by ${gameStats.adventurersRaisersCount} different raisers ${gameStats.adventurersRaisesCount} times.\n`;
		message += `${gameStats.groupsCount} groups ran.\n`;
		message += `${gameStats.epicKillsByGroup}/${gameStats.epicKillsSolo} epics were slain by groups/two-manned or soloed. Total: ${gameStats.epicKillsByGroup + gameStats.epicKillsSolo}.\n`;
		message += `${gameStats.itemsSoldCount} items were sold by ${gameStats.sellersCount} different sellers for the amount of ${Utility.formatNumber(gameStats.salesSum)}.\n`;

		this.logInfo(message);
		Utility.sendMessage(channel, message);
	}

	fetchGameStats(channel: TextChannel, period: PeriodType): void {
		this.fetchGameStatsAsync(channel, period).catch(err => this.logError(err));
	}

	async fetchBestSellersAsync(channel: TextChannel, period: PeriodType): Promise<void> {
		let bestSellers = await Statistics.fetchBestSellers(period);

		let message = `Best sellers rating from ${Utility.formatOnlyDate(bestSellers.start)} to ${Utility.formatOnlyDate(bestSellers.end)}.\n\n`;

		for (let i = 0; i < bestSellers.sales.length && i < this.RatingMaximum; ++i) {
			let d = bestSellers.sales[i];
			let roundedSize = Math.round(d.sum / d.count);

			message += `${i + 1}. ${EmporiumProcessor.buildItemLink(d.item)} was sold ${d.count} times. Average price was ${roundedSize}.\n`;
		}

		this.logInfo(message);
		Utility.sendMessage(channel, message);
	}

	fetchBestSellers(channel: TextChannel, period: PeriodType): void {
		this.fetchBestSellersAsync(channel, period).catch(err => this.logError(err));
	}

	checkOwnership(user: string, adventurer: string, channel: TextChannel): boolean {
		let charOwned = 0;
		if (user.toLowerCase() == adventurer.toLowerCase()) {
			// By default, everyone owns a character similarly named than their user
			charOwned = 2;
		} else {
			// Otherwise try to find the characters in the special map
			for (let user2 in Global.usersToCharacters) {
				if (user.toLowerCase() == user2.toLowerCase()) {
					charOwned = 1;
					let characters = Global.usersToCharacters[user];
					for (let i = 0; i < characters.length; ++i) {
						if (adventurer.toLowerCase() == characters[i].toLowerCase()) {
							charOwned = 2;
							break;
						}
					}
					break;
				}
			}
		}

		switch (charOwned) {
			case 0:
				Utility.sendMessage(channel, `Sorry, ${user}, but I don't contain the information about your characters. Contact Yang to fix that.`);
				break;
			case 1:
				Utility.sendMessage(channel, `Sorry, ${user}, but you don't seem to own the character ${adventurer}. Contact Yang if my information is incorrect.`);
				break;
			case 2:
				return true;
		}

		return false;
	}

	help(channel: TextChannel) {
		let message = "I know following commands:\n!topdeaths [week|month|**year**|all]\n!mostdeadly [week|month|**year**|all]\n!topraisers [week|month|**year**|all]\n!gamestats [week|month|**year**|all]\n!bestsellers [week|month|**year**|all]\n!bestleaders\n!mostdeadlyfor player_name\n!statfor player_name\n!victimsof mobile_name\n!epichistory epic_name\n";

		this.logInfo(message);
		Utility.sendMessage(channel, message);
	}

	getPeriod(parts: string[]): PeriodType {
		let result = PeriodType.Year;

		if (parts.length > 1) {
			if (parts[1] == "week") {
				result = PeriodType.Week;
			} else if (parts[1] == "month") {
				result = PeriodType.Month;
			} else if (parts[1] == "all") {
				result = PeriodType.AllTime;
			}
		}

		return result;
	}


	processMessage(msg: Message<boolean>) {
		if (msg.author.bot) {
			// Ignore bot messages
			return;
		}

		var content = msg.content;
		if (!content.startsWith("!")) {
			// Not a command
			return;
		}

		try {
			this.logInfo(`User: ${msg.author.username}, Command: ${msg.content.substring(1)}`);

			let parts = msg.content.substring(1).toLowerCase().split(' ');
			var command = parts[0];
			let channel = msg.channel as TextChannel;

			if (command == "help") {
				this.help(channel);
			} else if (command == "topdeaths") {
				let period = this.getPeriod(parts);
				this.fetchTopDeaths(channel, period);
			} else if (command == "mostdeadly") {
				let period = this.getPeriod(parts);
				this.fetchMostDeadly(channel, period);
			}
			else if (command.startsWith("mostdeadlyfor")) {
				if (parts.length != 2) {
					Utility.sendMessage(channel, "Usage: !mostdeadlyfor adventurer_name");
				} else {
					let user = msg.author.username;
					let adventurer = parts[1];

					if (this.checkOwnership(user, adventurer, channel)) {
						this.fetchMostDeadlyFor(channel, adventurer);
					}
				}
			}
			else if (command.startsWith("victimsof")) {
				if (parts.length == 1) {
					Utility.sendMessage(channel, "Usage: !victimsof mobile");
				} else {
					let args = msg.content.substring(11).trim();
					this.fetchVictimsOf(channel, args);
				}
			}
			else if (command.startsWith("epichistory")) {
				if (parts.length == 1) {
					Utility.sendMessage(channel, "Usage: !epichistory epic");
				} else {
					let args = msg.content.substring(13).trim();
					this.fetchEpicHistory(channel, args);
				}
			}
			else if (command == "topraisers") {
				let period = this.getPeriod(parts);
				this.fetchTopRaisers(channel, period);
			} else if (command == "bestsellers") {
				let period = this.getPeriod(parts);
				this.fetchBestSellers(channel, period);
			}else if (command == "bestleaders") {
				this.fetchBestLeaders(channel);
			} else if (command == "gamestats") {
				let period = this.getPeriod(parts);
				this.fetchGameStats(channel, period);
			} else if (command.startsWith("statfor") || command.startsWith("statsfor")) {
				let parts = content.split(' ');
				if (parts.length != 2) {
					Utility.sendMessage(channel, "Usage: !statfor adventurer_name");
				} else {
					let user = msg.author.username;
					let adventurer = parts[1];

					if (this.checkOwnership(user, adventurer, channel)) {
						this.fetchStatFor(channel, adventurer);
					}
				}
			}
		}
		catch (err) {
			this.logInfo(err);
		}
	}



	start() {
		this.client = new Client({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.MessageContent,
			]
		});

		this.client.on("ready", () => {
			this.groupsProcessor = new GroupsProcessor(this.client);
			this.epicsProcessor = new EpicsProcessor(this.client);
			this.emporiumProcessor = new EmporiumProcessor(this.client);
			this.forumProcessor = new ForumProcessor(this.client);
			this.alertsProcessor = new AlertsProcessor(this.client);

			this.emporiumProcessor.start();
			this.forumProcessor.start();
			this.alertsProcessor.start();
			this.groupsProcessor.start();

			// Don't start epics processor, since it would be run by groups processor
		});

		this.client.on('messageCreate', msg => this.processMessage(msg));

		this.client.login(Global.config.token);
	}
};

Main.instance = new Main();
Main.instance.start();