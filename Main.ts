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
		let mostDeadly = await Statistics.fetchMostDeadlies();

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
			var command = msg.content.substring(1).toLowerCase();
			this.logInfo(`Command: ${command}`);

			if (command == "topdeaths") {
				this.fetchTopDeaths(msg.channel as TextChannel);
			} else if (command == "mostdeadly") {
				this.fetchMostDeadly(msg.channel as TextChannel);
			} else if (command == "topraisers") {
				this.fetchTopRaisers(msg.channel as TextChannel);
			} else if (command == "bestleaders") {
				this.fetchBestLeaders(msg.channel as TextChannel);
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