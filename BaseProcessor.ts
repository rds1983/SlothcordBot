import { Client, Message, TextChannel, messageLink } from "discord.js";
import { Utility } from "./Utility";
import { LoggerWrapper } from "./LoggerWrapper";

global.XMLHttpRequest = require("xhr2");

const fs = require('fs');

export abstract class BaseProcessor {
	private readonly loggerWrapper: LoggerWrapper;
	private processStarted: number = null;
	private xhr: XMLHttpRequest;

	constructor() {
		this.loggerWrapper = new LoggerWrapper(this.getLoggerName());
	}

	abstract getName(): string;
	abstract process(onFinished: () => void): void;
	abstract runIntervalInMs(): number;

	getLoggerName(): string {
		return this.getName();
	}

	logError(message: any): void {
		this.loggerWrapper.logError(message);
	}

	logInfo(message: any): void {
		this.loggerWrapper.logInfo(message);
	}

	async loadPage(url: string): Promise<string> {
		this.logInfo(`Fetching data at url "${url}"`);

		let t = this;

		return new Promise(function (resolve, reject) {
			t.xhr = new XMLHttpRequest();

			t.xhr.open("get", url);
			t.xhr.onload = function () {
				if (this.status >= 200 && this.status < 300) {
					resolve(t.xhr.responseText);
				} else {
					reject({
						status: this.status,
						statusText: t.xhr.statusText
					});
				}

				t.xhr = null;
			};
			t.xhr.onerror = function () {
				reject({
					status: this.status,
					statusText: t.xhr.statusText
				});

				t.xhr = null;
			};

			t.xhr.onabort = function () {
				reject({
					status: this.status,
					statusText: "abort"
				});

				t.xhr = null;
			}

			t.xhr.send();
		});
	}

	private processWithFlag(): void {
		if (this.processStarted != null) {
			let diff = new Date().getTime() - this.processStarted;
			let seconds = Math.floor(diff / (1000));
			this.logInfo(`Can't run the process, since the last run is still in progress. It runs for ${seconds} seconds.`);

			if (this.xhr != null) {
				this.logInfo(`Trying to abort the http request...`);
				this.xhr.abort();
			}
			return;
		}

		this.processStarted = new Date().getTime();
		this.process(() => this.processStarted = null);

	}

	start(): void {
		this.processWithFlag();
		setInterval(() => this.processWithFlag(), this.runIntervalInMs());
	}
}

export abstract class BaseProcessorImpl<StatusType> extends BaseProcessor {
	channel: TextChannel;
	status: StatusType;

	constructor(client: Client) {
		super();

		this.status = this.loadStatus();

		this.channel = <TextChannel>client.channels.cache.find(c => {
			let gc = <TextChannel>c;
			return gc.name === this.getChannelName();
		});

		this.logInfo(`Channel #${this.getChannelName()}'s id: ${this.channel.id}`);
	}

	getStatusFileName(): string {
		return `status.${this.getName()}.json`;
	}

	getChannelName(): string {
		return `bot-${this.getName()}`;
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
		return Utility.sendMessage(this.channel, message);
	}

	async findMessage(includes: string, excludes: string[] = null): Promise<Message<true>> {
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
				let containsExclude = false;
				if (excludes != null) {
					for (let j = 0; j < excludes.length; ++j) {
						if (embed.description.includes(excludes[j])) {
							containsExclude = true;
							break;
						}
					}
				}

				if (!containsExclude) {
					result = message;
					break;
				}
			}
		}

		return result;
	}
}