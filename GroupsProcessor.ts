import { Client, EmbedBuilder } from "discord.js";
import { BaseProcessorImpl } from "./BaseProcessor";
import { Utility } from "./Utility";
import { JSDOM } from 'jsdom';
import { GroupInfo, Statistics } from "./Statistics";
import { Main } from "./Main";

class Group {
	leader: string;
	initialLeader: string;
	name: string;
	continent: string;
	adventurers: string[];
	started: number;
	movedToLyme: number;
}


export class GroupsProcessor extends BaseProcessorImpl<{ [leader: string]: Group }> {
	constructor(client: Client) {
		super(client);
	}

	getName(): string {
		return "groups";
	}

	override getLoggerName(): string {
		return "groups-epics";
	}

	runIntervalInMs(): number {
		return 5 * 60 * 1000;
	}

	async appendMessage(leader: string, append: string, started: number): Promise<void> {
		this.logInfo(`appendAndReportMessage for the group of ${leader}: ${append}`);

		// Find the group message
		let groupMessage = await this.findMessage(`${leader} started`);

		if (groupMessage == null) {
			this.logInfo(`WARNING: could not find message for group of ${leader}`);
			return;
		} else {
			this.logInfo(`Group message id: ${groupMessage.id}`);
		}

		let embed = groupMessage.embeds[0];

		let desc = embed.description;

		desc += "\n";
		if (started != null) {
			let diff = new Date().getTime() - started;
			let hours = Math.floor(diff / (1000 * 60 * 60));
			diff -= hours * (1000 * 60 * 60);

			let mins = Math.floor(diff / (1000 * 60));
			diff -= mins * (1000 * 60);

			desc += `(+${Utility.formatTwoDigits(hours)}:${Utility.formatTwoDigits(mins)})`;
		}

		desc += ` ${append}`;

		// Edit the group message
		const newEmbed = new EmbedBuilder().setDescription(desc);
		await groupMessage.edit({ embeds: [newEmbed] });

		await this.makeChannelWhite();
	}

	async internalProcess(): Promise<void> {
		let currentGroup = await Statistics.getCurrentGroupInfo();
		if (currentGroup != null) {
			// If there's current group, then process epics first
			// So defeated epics would be attributed to the current group
			this.logInfo("There is current group. Processing epics first");
			await Main.instance.epicsProcessor.internalProcess();
		}

		let data = await this.loadPage("http://www.slothmud.org/wp/live-info/adventuring-parties");
		let dom = new JSDOM(data);
		let document = dom.window.document;

		let all = document.getElementsByTagName("tr");
		let newGroups: { [leader: string]: Group } = {};
		let group: Group = null;
		for (let i = 0; i < all.length; i++) {
			let children = all[i].childNodes;

			// Check if it's group header row
			let td = children[0];
			if ("colSpan" in td && td.colSpan == "3") {
				let re = /(\w+) is leading '(.*)' on (.*):/;
				let m = re.exec(td.textContent);
				if (m) {
					// Store last group
					if (group != null) {
						newGroups[group.leader] = group;
					}

					let name = m[2];
					let leader = m[1];
					let continent = m[3];

					group =
					{
						initialLeader: leader,
						leader: leader,
						name: name,
						continent: continent,
						adventurers: [],
						started: null,
						movedToLyme: null
					};

					continue;
				}
			}

			if (group == null) {
				continue;
			}

			if (children.length == 3) {
				// Member row
				group.adventurers.push(children[2].textContent.trim());
			}
		}

		// Store last group
		// Store existing group
		if (group != null) {
			newGroups[group.leader] = group;
		}

		// Remove groups with less than 3 adventurers
		let toDelete: string[] = [];
		for (let leader in newGroups) {
			if (newGroups[leader].adventurers.length < 3) {
				toDelete.push(leader);
			}
		}

		for (let i = 0; i < toDelete.length; ++i) {
			let leader = toDelete[i];
			delete newGroups[leader];
		}

		try {
			if (this.status != null) {
				// Update initial leaders
				for (let leader in newGroups) {
					let newGroup = newGroups[leader];
					if (leader in this.status) {
						let oldGroup = this.status[leader];
						newGroup.initialLeader = oldGroup.initialLeader;

						if ("started" in oldGroup) {
							newGroup.started = oldGroup.started;
						}
					}
				}

				// Check for groups that were over or had changed the leader
				let leaderChanges: { [leader: string]: string } = {};
				for (let oldLeader in this.status) {
					let oldGroup = this.status[oldLeader];

					if (!(oldLeader in newGroups)) {
						// Check for the leader change
						let changedLeader = false;
						for (let newLeader in newGroups) {
							let newGroup = newGroups[newLeader];

							let matches = 0;

							// Calculate how many adventurers from the old group presents in the new group
							for (let i = 0; i < oldGroup.adventurers.length; ++i) {
								for (let j = 0; j < newGroup.adventurers.length; ++j) {
									if (oldGroup.adventurers[i] == newGroup.adventurers[j]) {
										++matches;
									}
								}
							}

							this.logInfo(`Amount of matches for ${oldLeader}/${newLeader}: ${matches}`);

							// If rate of matches >= 0.6 for both groups, then it's the leader change
							var oldRate = matches / oldGroup.adventurers.length;
							var newRate = matches / newGroup.adventurers.length;
							this.logInfo(`Old rate/new rate: ${oldRate}/${newRate}`);

							if (oldRate >= 0.6 && newRate >= 0.6) {
								changedLeader = true;
								newGroup.initialLeader = oldGroup.initialLeader;
								newGroup.started = oldGroup.started;
								leaderChanges[oldLeader] = newLeader;
								await this.appendMessage(oldGroup.initialLeader, `${newLeader} became the new leader.`, oldGroup.started);
								await Statistics.storeGroupEnded(oldLeader);
								await Statistics.storeGroupStarted(newLeader, newGroup.continent, newGroup.adventurers.length);
								break;
							}
						}

						if (!changedLeader) {
							await this.appendMessage(oldGroup.initialLeader, `The group was over.`, oldGroup.started);
							await Statistics.storeGroupEnded(oldLeader);
						}
					}
				}

				// Update old groups with the leader changes
				for (let oldLeader in leaderChanges) {
					let newLeader = leaderChanges[oldLeader];
					let oldGroup = this.status[oldLeader];
					delete this.status[oldLeader];
					this.status[newLeader] = oldGroup;
				}

				// Check for new and renamed groups
				for (let newLeader in newGroups) {
					let newGroup = newGroups[newLeader];
					if (!(newLeader in this.status)) {
						newGroup.started = new Date().getTime();
						await this.sendMessage(`${newLeader} started group '${newGroup.name}' at ${newGroup.continent}. Group consisted of ${newGroup.adventurers.length} adventurers.`)
						await Statistics.storeGroupStarted(newLeader, newGroup.continent, newGroup.adventurers.length);
					} else {
						let oldGroup = this.status[newLeader];

						// Ignore group name changes caused by the leader change
						if (oldGroup.name != newGroup.name && !Object.values(leaderChanges).includes(newLeader)) {
							await this.appendMessage(oldGroup.initialLeader, `${newLeader} changed group name to '${newGroup.name}'`, oldGroup.started);
						}

						if (oldGroup.continent != newGroup.continent) {
							await this.appendMessage(oldGroup.initialLeader, `Moved to ${newGroup.continent}.`, oldGroup.started);

							if (newGroup.continent == "Lyme") {
								newGroup.movedToLyme = Utility.getUnixTimeStamp();
							} else {
								newGroup.movedToLyme = null;
							}
						}

						let oldSizeDivided = Math.floor(oldGroup.adventurers.length / 4);
						let newSizeDivided = Math.floor(newGroup.adventurers.length / 4);

						if (newSizeDivided > oldSizeDivided) {
							await this.appendMessage(oldGroup.initialLeader, `The group became bigger. Now it has as many as ${newGroup.adventurers.length} adventurers.`, oldGroup.started);
						}

						if (newSizeDivided < oldSizeDivided) {
							await this.appendMessage(oldGroup.initialLeader, `The group became smaller. Now it has only ${newGroup.adventurers.length} adventurers.`, oldGroup.started);
						}

						if (oldGroup.adventurers.length != newGroup.adventurers.length || oldGroup.continent != newGroup.continent) {
							await Statistics.storeGroupEnded(newLeader);
							await Statistics.storeGroupStarted(newLeader, newGroup.continent, newGroup.adventurers.length);
						}
					}
				}
			}

			// Log groups
			for (let newLeader in newGroups) {
				let newGroup = newGroups[newLeader];
				this.logInfo(Utility.toString(newGroup));
			}
		}
		catch (err) {
			this.logInfo(err);
		}

		this.status = newGroups;
		this.saveStatus();

		if (currentGroup == null) {
			// If there wasn't current group, then process epics last
			// So defeated epics would be attributed to the new group(if it was started)
			this.logInfo("There isn't current group. Processing epics last");
			await Main.instance.epicsProcessor.internalProcess();
		}
	}

	public async reportEpicKilled(groupInfo: GroupInfo, epic: string): Promise<void> {
		if (this.status == null || !(groupInfo.leader in this.status)) {
			this.logInfo(`Epic kill reporting failed. Couldn't find group led by ${groupInfo.leader}. Current groups:`);
			for (let leader in this.status) {
				let group = this.status[leader];
				this.logInfo(Utility.toString(group));
			}
			return;
		}

		let group = this.status[groupInfo.leader];
		await this.appendMessage(group.initialLeader, `Defeated ${epic}.`, group.started);
	}

	process(onFinished: () => void): void {
		this.internalProcess().catch(err => this.logError(err)).finally(onFinished);
	}
}