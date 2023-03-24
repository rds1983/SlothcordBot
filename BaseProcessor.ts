import { Client, EmbedBuilder, Message, TextChannel } from "discord.js";
import { Logger } from "winston";
import { Utility } from "./Utility";

const fs = require('fs');

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

		this.logger = Utility.createLogger(this.getName());

		this.status = this.loadStatus();

		this.channel = <TextChannel>client.channels.cache.find(c => {
			let gc = <TextChannel>c;
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
		let request = await Utility.makeRequest('get', url);

		return request;
	}

	loadStatus(): StatusType {
		let statusFileName = this.getStatusFileName();
		if (fs.existsSync(statusFileName)) {
			try {
				this.logInfo(`Status file ${statusFileName} was found.`);

				let data = fs.readFileSync(statusFileName);
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
		let statusFileName = this.getStatusFileName();

		// Save new status
		this.logInfo(`Saving new status ${statusFileName}...`);
		let json = JSON.stringify(this.status, null, 2);

		fs.writeFileSync(statusFileName, json, 'utf8');
	}

	async makeChannelWhite(): Promise<void> {
		try {
			// Post and delete something just to make the channel white
			let msg = await this.channel.send("something");
			await msg.delete();
		}
		catch (err: any) {
			this.logError(err);
		}
	}

	async sendMessage(message: string): Promise<Message<true>> {
		this.logInfo(`${message}`);

		const embed = new EmbedBuilder().setDescription(message);
		return this.channel.send({ embeds: [embed] });
	}

	async findMessage(includes: string): Promise<Message<true>> {
		let result: Message<true> = null;
		let messages = await this.channel.messages.fetch({ limit: 10 });
		let messagesArray = Array.from(messages.values());
		for (let i = 0; i < messagesArray.length; ++i) {
			let message = messagesArray[i];
			if (message.embeds.length == 0) {
				continue;
			}
			let embed = message.embeds[0];

			if (embed.description.includes(includes)) {
				result = message;
				break;
			}
		}

		return result;
	}
}