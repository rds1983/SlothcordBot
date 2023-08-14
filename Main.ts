import { Client, GatewayIntentBits, Message, TextChannel } from "discord.js";
import { AlertsProcessor } from "./AlertsProcessor";
import { EmporiumProcessor } from "./EmporiumProcessor";
import { EpicsProcessor } from "./EpicsProcessor";
import { ForumProcessor } from "./ForumProcessor";
import { Global } from "./Global";
import { GroupsProcessor } from "./GroupsProcessor";
import { Statistics } from "./Statistics";
import { LoggerWrapper } from "./LoggerWrapper";
import { BaseProcessor } from "./BaseProcessor";
import { Utility } from "./Utility";

Global.config = require('./config.json');
Global.usersToCharacters = require('./usersToCharacters.json');

let s = Global.usersToCharacters;

class Main {
	private readonly RatingMaximum: number = 10;

	private readonly loggerWrapper: LoggerWrapper = new LoggerWrapper("main");
	private processors: BaseProcessor[] = [];
	private client: Client;

	logError(message: any): void {
		this.loggerWrapper.logError(message);
	}

	logInfo(message: any): void {
		this.loggerWrapper.logInfo(message);
	}

	async fetchTopDeathsAsync(channel: TextChannel): Promise<void> {
		let topDeaths = await Statistics.fetchTopDeaths();

		let message = `Top deaths rating from ${Utility.formatOnlyDate(topDeaths.start)} to ${Utility.formatOnlyDate(topDeaths.end)}.\n\n`;

		for (let i = 0; i < topDeaths.players.length && i < this.RatingMaximum; ++i) {
			let pd = topDeaths.players[i];
			message += `${i + 1}. ${pd.name} died ${pd.count} times.\n`;
		}

		this.logInfo(message);
		Utility.sendMessage(channel, message);
	}

	fetchTopDeaths(channel: TextChannel): void {
		this.fetchTopDeathsAsync(channel).catch(err => this.logError(err));
	}

	async fetchMostDeadlyAsync(channel: TextChannel): Promise<void> {
		let mostDeadly = await Statistics.fetchMostDeadly();

		let message = `Most deadly rating from ${Utility.formatOnlyDate(mostDeadly.start)} to ${Utility.formatOnlyDate(mostDeadly.end)}.\n\n`;

		for (let i = 0; i < mostDeadly.deadlies.length && i < this.RatingMaximum; ++i) {
			let d = mostDeadly.deadlies[i];
			message += `${i + 1}. ${d.name} killed ${d.count} times.\n`;
		}

		this.logInfo(message);
		Utility.sendMessage(channel, message);
	}

	fetchMostDeadly(channel: TextChannel): void {
		this.fetchMostDeadlyAsync(channel).catch(err => this.logError(err));
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

	async fetchTopRaisersAsync(channel: TextChannel): Promise<void> {
		let topRaisers = await Statistics.fetchTopRaisers();

		let message = `Top raisers rating from ${Utility.formatOnlyDate(topRaisers.start)} to ${Utility.formatOnlyDate(topRaisers.end)}.\n\n`;

		for (let i = 0; i < topRaisers.raisers.length && i < this.RatingMaximum; ++i) {
			let d = topRaisers.raisers[i];
			message += `${i + 1}. ${d.name} raised ${d.count} times.\n`;
		}

		this.logInfo(message);
		Utility.sendMessage(channel, message);
	}

	fetchTopRaisers(channel: TextChannel): void {
		this.fetchTopRaisersAsync(channel).catch(err => this.logError(err));
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

			var command = msg.content.substring(1).toLowerCase();
			let channel = msg.channel as TextChannel;
			if (command == "topdeaths") {
				this.fetchTopDeaths(channel);
			} else if (command == "mostdeadly") {
				this.fetchMostDeadly(channel);
			}
			else if (command.startsWith("mostdeadlyfor")) {
				let parts = content.split(' ');
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
			else if (command == "topraisers") {
				this.fetchTopRaisers(channel);
			} else if (command == "bestleaders") {
				this.fetchBestLeaders(channel);
			} else if (command.startsWith("statfor")) {
				let parts = content.split(' ');
				if (parts.length != 2) {
					Utility.sendMessage(channel, "Usage: !statfor adventurer_name");
				} else {
					let user = msg.author.username;
					let adventurer = parts[1];

					if (this.checkOwnership(user, adventurer, channel)) 
					{
						this.fetchStatFor(channel, adventurer);
					}
				}
			}

			/*				if (command == "epics") {
								var result = "";
								for (var i = 0; i < statusEpics.length; ++i) {
									var epic = statusEpics[i];
									result += `${i + 1}. ${epic.name} in ${epic.area} at ${epic.continent}\n`;
								}
			
								sendMessage(msg.channel, result);
							}*/
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
			this.processors.push(new GroupsProcessor(this.client));
			this.processors.push(new EpicsProcessor(this.client));
			this.processors.push(new EmporiumProcessor(this.client));
			this.processors.push(new ForumProcessor(this.client));
			this.processors.push(new AlertsProcessor(this.client));

			for (let i = 0; i < this.processors.length; ++i) {
				this.processors[i].start();
			}
		});

		this.client.on('messageCreate', msg => this.processMessage(msg));

		this.client.login(Global.config.token);
	}
};

let main: Main = new Main();
main.start();