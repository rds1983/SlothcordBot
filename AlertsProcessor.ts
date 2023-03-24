import { Client, EmbedBuilder } from "discord.js";
import { JSDOM } from "jsdom";
import { BaseProcessorImpl } from "./BaseProcessor";

enum EventType {
	Death,
	Raise,
	Shock
}

class Event {
	type: EventType;
	adventurer: string;
	doer: string;
	time: string;
}

class EventParseInfo {
	regex: RegExp;
	doerFirst: boolean;

	constructor(regex: string, doerFirst: boolean) {
		this.regex = new RegExp(regex, "s");
		this.doerFirst = doerFirst;
	}
}

export class AlertsProcessor extends BaseProcessorImpl<Event[]>
{
	private static readonly DeathParsers: EventParseInfo[] =
		[
			new EventParseInfo("(.+) handidly dispatched (\\w+) to to the next world\\.", true),
			new EventParseInfo("(.+) mercilessly slaughtered (\\w+)\\.", true),
			new EventParseInfo("(.+) mercilessly butchered (\\w+)\\.", true),
			new EventParseInfo("(.+) obliterated (\\w+)\\.", true),
			new EventParseInfo("(.+) annihilated (\\w+)\\.", true),
			new EventParseInfo("(.+) defeated (\\w+)\\.", true),
			new EventParseInfo("(.+) slew (\\w+)\\.", true),
			new EventParseInfo("(.+) wasted (\\w+)\\.", true),
			new EventParseInfo("(.+) crushed (\\w+) to a liveless pulp of blood and offals\\.", true),
			new EventParseInfo("(\\w+) was slain by (.+)\\.", false),
			new EventParseInfo("(\\w+) was defeated by (.+)\\.", false),
			new EventParseInfo("(\\w+) was messily dispatched by (.+)\\.", false),
			new EventParseInfo("(\\w+) was beaten down by (.+)\\.", false),
			new EventParseInfo("(\\w+) naively fought (.+) and lost\\.", false),
			new EventParseInfo("(\\w+) fought against (.+) and lost\\.", false)
		];

	private static readonly RaiseParsers: EventParseInfo[] =
		[
			new EventParseInfo("(\\w+) sold a piece of soul to the devil in exchange for (\\w+)'s worthless soul", true),
			new EventParseInfo("The clerical genius (\\w+) successfully raised (\\w+)\\.", true),
			new EventParseInfo("(\\w+)'s prayers were answered and (\\w+) was successfully raised\\.", true),
			new EventParseInfo("(\\w+) raised from the dead by (\\w+)\\.", false)
		];

	private static readonly ShockParsers: EventParseInfo[] =
		[
			new EventParseInfo("(\\w+) shocked (\\w+)\\.", true),
			new EventParseInfo("(\\w+) knelt, prayed, and still managed to shock (\\w+)\\.", true),
			new EventParseInfo("(\\w+) was banished to ether by (\\w+)'s lack of raising ability\\.", false),
			new EventParseInfo("The gods liked (\\w+)'s soul so much that they want to keep it\\s+\\-\\s+(\\w+) was not convincing enough to cheat death.", false)
		];

	constructor(client: Client) {
		super(client);
	}

	getName(): string {
		return "alerts";
	}

	runIntervalInMs(): number {
		return 30 * 1000;
	}

	private static processEventWithParser(type: EventType, parser: EventParseInfo, text: string, time: string, newEvents: Event[]): boolean {
		let m = parser.regex.exec(text);
		if (m) {
			let adventurer: string;
			let doer: string;
			if (parser.doerFirst) {
				adventurer = m[2];
				doer = m[1];
			} else {
				adventurer = m[1];
				doer = m[2];
			}

			let newEvent: Event =
			{
				type: type,
				adventurer: adventurer,
				doer: doer,
				time: time
			};

			newEvents.push(newEvent);

			return true;
		}

		return false;
	}

	private static processEventWithParsers(type: EventType, parsers: EventParseInfo[], text: string, time: string, newEvents: Event[]): boolean {
		for (let i = 0; i < parsers.length; ++i) {
			if (AlertsProcessor.processEventWithParser(type, parsers[i], text, time, newEvents)) {
				return true;
			}
		}

		return false;
	}

	async reportDeath(event: Event): Promise<void> {
		this.sendMessage(`${event.adventurer} was slain by ${event.doer}.`);
	}

	async reportRaise(adventurer: string, raiser: string): Promise<void> {
		// Find the raise message
		let raiseMessage = await this.findMessage(`${adventurer} was slain by`);

		if (raiseMessage == null) {
			this.logInfo(`WARNING: could not find death message of ${adventurer}`);
			return;
		} else {
			this.logInfo(`Death message id: ${raiseMessage.id}`);
		}

		let embed = raiseMessage.embeds[0];

		let desc = embed.description;

		desc += `\nRaised by ${raiser}.`;

		// Edit the group message
		const newEmbed = new EmbedBuilder().setDescription(desc);
		await raiseMessage.edit({ embeds: [newEmbed] });

		await this.makeChannelWhite();
	}

	async reportShock(adventurer: string): Promise<void> {
		// Find the raise message
		let raiseMessage = await this.findMessage(`${adventurer} was slain by`);

		if (raiseMessage == null) {
			this.logInfo(`WARNING: could not find death message of ${adventurer}`);
			return;
		} else {
			this.logInfo(`Death message id: ${raiseMessage.id}`);
		}

		let embed = raiseMessage.embeds[0];

		let desc = embed.description;

		desc += `\nShocked.`;

		// Edit the group message
		const newEmbed = new EmbedBuilder().setDescription(desc);
		await raiseMessage.edit({ embeds: [newEmbed] });

		await this.makeChannelWhite();
	}

	async internalProcess(): Promise<void> {
		this.logInfo("Checking alerts...");

		let data = await this.loadPage("http://www.slothmud.org/wp/live-info/live-blog");
		let dom = new JSDOM(data);
		let document = dom.window.document;

		let newEvents: Event[] = [];
		let rows = document.getElementsByTagName("tr");
		for (let i = 0; i < rows.length; i++) {
			let row = rows[i];

			if (row.childNodes.length != 2) {
				continue;
			}

			let time = row.childNodes[0].textContent.trim();
			let eventText = row.childNodes[1].textContent.trim();

			if (!AlertsProcessor.processEventWithParsers(EventType.Death, AlertsProcessor.DeathParsers, eventText, time, newEvents) &&
				!AlertsProcessor.processEventWithParsers(EventType.Raise, AlertsProcessor.RaiseParsers, eventText, time, newEvents) &&
				!AlertsProcessor.processEventWithParsers(EventType.Shock, AlertsProcessor.ShockParsers, eventText, time, newEvents)) {
				this.logInfo(`'${eventText}' neither death or raise or shock.`);
			}
		}

		if (this.status != null) {
			let oldTopEvent = this.status[0];
			let oldTopEventIndex: number = null;
			for (let i = 0; i < newEvents.length; ++i) {
				let newEvent = newEvents[i];

				if (newEvent.type == oldTopEvent.type && newEvent.adventurer == oldTopEvent.adventurer && newEvent.doer == oldTopEvent.doer && newEvent.time == oldTopEvent.time) {
					oldTopEventIndex = i;
					break;
				}
			}

			this.logInfo(`oldTopEventIndex: ${oldTopEventIndex}`);

			if (oldTopEventIndex != null) {
				// All events before oldTopEventIndex are new
				// First report deaths
				for (let i = 0; i < oldTopEventIndex; ++i) {
					let newEvent = newEvents[i];

					if (newEvent.type == EventType.Death) {
						await this.reportDeath(newEvent);
					}
				}

				// Now report raises and shocks
				for (let i = 0; i < oldTopEventIndex; ++i) {
					let newEvent = newEvents[i];

					if (newEvent.type == EventType.Raise) {
						await this.reportRaise(newEvent.adventurer, newEvent.doer);
					} else if (newEvent.type == EventType.Shock) {
						await this.reportShock(newEvent.adventurer);
					}
				}
			} else {
				this.logInfo(`WARNING: could not find oldTopEventIndex`);
			}
		}

		this.status = newEvents;
		this.saveStatus();
	}

	process(): void {
		this.internalProcess().catch(err => this.logError(err));
	}
}