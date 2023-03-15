import { Client, EmbedBuilder, Message, TextChannel } from "discord.js";
import { Logger } from "winston";
import { Utility } from "./Utility";

const fs = require('fs');
const winston = require('winston');
const { combine, timestamp, printf } = winston.format;

export abstract class BaseProcessor {
	abstract process(): void;
	abstract runIntervalInMs(): number;

	start(): void {
		this.process();

		setInterval(() => this.process(), this.runIntervalInMs());
	}
}

export abstract class BaseProcessorImpl<StatusType> extends BaseProcessor {
	private logger: Logger;

	channel: TextChannel;
	status: StatusType;

	constructor(client: Client) {
		super();

		this.logger = winston.createLogger({
			format: combine(
				timestamp({
					format: 'YYYY-MM-DD HH:mm:ss',
				}),
				printf((info: any) => `[${info.timestamp}] ${info.level}: ${info.message}`)
			),
			transports: [
				new winston.transports.Console(),
				new winston.transports.File({ filename: `log.${this.getName()}.txt`, json: false }),
			],
		});

		this.status = this.loadStatus();

		this.channel = <TextChannel>client.channels.cache.find(c => {
			var gc = <TextChannel>c;
			return gc.name === this.getChannelName();
		});

		this.logInfo(`Channel #${this.getChannelName()}'s id: ${this.channel.id}`);
	}

	abstract getName(): string;

	getStatusFileName(): string {
		return `status.${this.getName()}.json`;
	}

	getChannelName(): string {
		return `bot-${this.getName()}`;
	}

	logError(message: any): void {
		this.logger.log({
			level: 'error',
			message: Utility.toString(message)
		});
	}

	logInfo(message: any): void {
		this.logger.log({
			level: 'info',
			message: Utility.toString(message)
		});
	}

	async loadPage(url: string): Promise<string> {
		this.logInfo(`Fetching data at url "${url}"`);
		var request = await Utility.makeRequest('get', url);

		return request;
	}

	loadStatus(): StatusType {
		var statusFileName = this.getStatusFileName();
		if (fs.existsSync(statusFileName)) {
			try {
				this.logInfo(`Status file ${statusFileName} was found.`);

				var data = fs.readFileSync(statusFileName);
				return JSON.parse(data);
			}
			catch (err: any) {
				this.logError(err);
			}
		} else {
			this.logInfo(`Couldn't find the status file ${statusFileName}.`);
		}

		return null;
	}

	saveStatus(): void {
		var statusFileName = this.getStatusFileName();

		// Save new status
		this.logInfo(`Saving new status ${statusFileName}...`);
		var json = JSON.stringify(this.status, null, 2);

		fs.writeFileSync(statusFileName, json, 'utf8');
	}

	async makeChannelWhite(): Promise<void> {
		// Post and delete something just to make the channel white
		var msg = await this.channel.send("something");
		await msg.delete();
	}

	async sendMessage(message: string): Promise<Message<true>> {
		this.logInfo(`${message}`);

		const embed = new EmbedBuilder().setDescription(message);
		return this.channel.send({ embeds: [embed] });
	}
}