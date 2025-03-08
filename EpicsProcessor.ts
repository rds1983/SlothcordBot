import { Client } from "discord.js";
import { JSDOM } from "jsdom";
import { BaseProcessorImpl } from "./BaseProcessor";
import { Statistics } from "./Statistics";
import { Main } from "./Main";
import { Constants } from "./Constants";

class Epic {
	name: string;
	area: string;
	continent: string;
}

export class EpicsProcessor extends BaseProcessorImpl<Epic[]> {
	private static continentOrder = ["Thordfalan", "Thule", "Niebelung", "The Island", "Lyme", "Euridyce", "Valkyre"];

	constructor(client: Client) {
		super(client);
	}

	getName(): string {
		return "epics";
	}

	override getLoggerName(): string {
		return "groups-epics";
	}

	runIntervalInMs(): number {
		return 5 * 60 * 1000;
	}

	async internalProcess(): Promise<void> {
		this.logInfo("Checking epics...");

		let data = await this.loadPage(Constants.EpicsUrl);
		let dom = new JSDOM(data);
		let document = dom.window.document;

		let newEpics: Epic[] = [];
		let all = document.getElementsByTagName("div");
		for (let i = 0; i < all.length; i++) {
			let div = all[i];

			let area = div.getAttribute("area");
			let continent = div.getAttribute("continent");

			if (area == null || continent == null) {
				continue;
			}

			// Filter out non real epics
			if (continent.toLowerCase() == "godsland") {
				continue;
			}

			if (continent.toLowerCase() == "valkyre" && !area.toLowerCase().startsWith("dark")) {
				continue;
			}

			let name = div.textContent;

			this.logInfo(`${name}; ${area}; ${continent}`);

			let epic: Epic =
			{
				name: name,
				area: area,
				continent: continent
			}

			newEpics.push(epic);
		}

		this.logInfo(`Epics count: ${newEpics.length}`);
		if (newEpics.length == 0) {
			this.logInfo(`Ignoring epics processing...`);
			return;
		}

		try {
			let changed = false;
			if (this.status != null) {
				// Report new epics
				for (let i = 0; i < newEpics.length; ++i) {
					let newEpic = newEpics[i];
					let found = false;
					for (let j = 0; j < this.status.length; ++j) {
						let oldEpic = this.status[j];

						if (newEpic.name == oldEpic.name) {
							found = true;
							break;
						}
					}

					if (!found) {
						await Statistics.storeEpicSpawn(newEpic.name);

						changed = true;
					}
				}

				// Report killed epics
				for (let i = 0; i < this.status.length; ++i) {
					let oldEpic = this.status[i];
					let found = false;
					for (let j = 0; j < newEpics.length; ++j) {
						let newEpic = newEpics[j];

						if (newEpic.name == oldEpic.name) {
							found = true;
							break;
						}
					}

					if (!found) {
						let groupId: number = null;
						let currentGroup = await Statistics.getCurrentGroupInfo();
						if (currentGroup != null) {
							await Main.instance.groupsProcessor.reportEpicKilled(currentGroup, oldEpic.name);
							groupId = currentGroup.id;
							this.logInfo(`${oldEpic.name} was slain by a group led by ${currentGroup.leader}`);
						} else {
							this.logInfo(`${oldEpic.name} was slain`);
						}

						await Statistics.storeEpicKill(oldEpic.name, groupId);

						changed = true;
					}
				}
			} else {
				changed = true;
			}

			if (changed) {
				// Group epics by continents
				let epicsGrouped: { [continent: string]: Epic[] } = {};
				for (let i = 0; i < newEpics.length; ++i) {
					let epic = newEpics[i];
					if (!(epic.continent in epicsGrouped)) {
						epicsGrouped[epic.continent] = [];
					}

					epicsGrouped[epic.continent].push(epic);
				}

				// Build message
				let result = "";
				for (let i = 0; i < EpicsProcessor.continentOrder.length; ++i) {
					let continent = EpicsProcessor.continentOrder[i];
					if (!(continent in epicsGrouped)) {
						continue;
					}

					result += `${continent}:\n`;

					for (let i = 0; i < epicsGrouped[continent].length; ++i) {
						let epic = epicsGrouped[continent][i];
						result += `- ${epic.name} at ${epic.area}\n`;
					}
				}

				result += `\nTotal epics: ${newEpics.length}\n`;

				// Fetch old messages
				let messages = await this.channel.messages.fetch();
				let messagesArray = Array.from(messages.values());

				// Post new messages with the epics' status
				await this.sendMessage(result);

				// Delete old messages
				try {
					for (let i = 0; i < messagesArray.length; ++i) {
						await messagesArray[i].delete();
					}
				}
				catch (err: any) {
					this.logError(err);
				}
			}
		}
		catch (err) {
			this.logError(err);
		}

		this.status = newEpics;
		this.saveStatus();
	}

	process(onFinished: () => void): void {
		this.internalProcess().catch(err => this.logError(err)).finally(onFinished);
	}
}