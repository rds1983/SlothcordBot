import { Client, EmbedBuilder, GatewayIntentBits, Message, TextChannel } from "discord.js";
import { AlertsProcessor } from "./AlertsProcessor";
import { EmporiumProcessor } from "./EmporiumProcessor";
import { EpicsProcessor } from "./EpicsProcessor";
import { ForumProcessor } from "./ForumProcessor";
import { Global } from "./Global";
import { GroupsProcessor } from "./GroupsProcessor";
import { EpicHistoryEventType, PeriodType, StatInfo, Statistics } from "./Statistics";
import { LoggerWrapper } from "./LoggerWrapper";
import { Utility } from "./Utility";

Global.config = require('./config.json');
Global.usersToCharacters = require('./usersToCharacters.json');

let s = Global.usersToCharacters;

class TopStatInfo {
	public name: string;
	public deathsPlace: number;
	public raisersPlace: number;
	public leadersPlace: number;
	public merchantsPlace: number;
	public score: number;
}

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

	formatPlaceWithMedal(place: number, addMedal: boolean): string {
		if (place == null) {
			return "";
		}

		let result = `${place + 1}. `;

		if (addMedal) {
			switch (place) {
				case 0:
					result += ":first_place: ";
					break;

				case 1:
					result += ":second_place: ";
					break;

				case 2:
					result += ":third_place: ";
					break;
			}
		}

		return result;
	}

	async fetchTopDeathsAsync(channel: TextChannel, period: PeriodType): Promise<void> {
		let topDeaths = await Statistics.fetchTopDeaths(period);

		let message = `Top deaths rating from ${Utility.formatOnlyDate(topDeaths.start)} to ${Utility.formatOnlyDate(topDeaths.end)}.\n\n`;

		for (let i = 0; i < topDeaths.players.length && i < this.RatingMaximum; ++i) {
			let pd = topDeaths.players[i];
			let raiseRate = Math.round(pd.raises * 100.0 / pd.count);
			message += `${this.formatPlaceWithMedal(i, true)}${pd.name} died ${pd.count} times. Was raised ${pd.raises} times (${raiseRate}%).\n`;
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
			message += `${this.formatPlaceWithMedal(i, true)}${d.name} killed ${d.count} times. Raised ${d.raises} times (${raiseRate}%).\n`;
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
			message += `${this.formatPlaceWithMedal(i, false)}${d.name} killed you ${d.count} times.\n`;
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
				message += `${this.formatPlaceWithMedal(i, false)}Killed ${d.name} ${d.count} times.\n`;
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

				if (d.eventType == EpicHistoryEventType.Appeared) {
					message += `Appeared\n`;
				} else if (d.leader == null) {
					message += `Disappeared\n`;
				} else {
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

	formatPlace(place: number): string {
		if (place == null) {
			return "";
		}

		let result = "";

		switch (place) {
			case 0:
				result = ":first_place:";
				break;

			case 1:
				result = ":second_place:";
				break;

			case 2:
				result = ":third_place:";
				break;

			default:
				result = `${place + 1}th`;
				break;
		}

		return result;
	}

	async fetchStatForAsync(channel: TextChannel, character: string, period: PeriodType): Promise<void> {
		let statFor = await Statistics.fetchStatFor(character, period);

		let message = `Statistics for ${character} from ${Utility.formatOnlyDate(statFor.start)} to ${Utility.formatOnlyDate(statFor.end)}.\n\n`;

		message += `You died ${statFor.deathsCount} times`;
		if (statFor.deathsPlace != null) {
			message += ` (${this.formatPlace(statFor.deathsPlace)})`;
		}
		message += ".\n";

		message += `You were raised ${statFor.wereRaisedCount} times.\n`;

		message += `You raised someone ${statFor.raisedSomeoneCount} times`;
		if (statFor.raisersPlace != null) {
			message += ` (${this.formatPlace(statFor.raisersPlace)})`;
		}
		message += ".\n";

		message += `You sold ${statFor.salesCount} items for ${statFor.salesSum} gold coins at the auction`;
		if (statFor.merchantsPlace != null) {
			message += ` (${this.formatPlace(statFor.merchantsPlace)})`;
		}
		message += ".\n";

		this.logInfo(message);
		Utility.sendMessage(channel, message);
	}

	fetchStatFor(channel: TextChannel, character: string, period: PeriodType): void {
		this.fetchStatForAsync(channel, character, period).catch(err => this.logError(err));
	}

	async fetchTopRaisersAsync(channel: TextChannel, period: PeriodType): Promise<void> {
		let topRaisers = await Statistics.fetchTopRaisers(period);

		let message = `Top raisers rating from ${Utility.formatOnlyDate(topRaisers.start)} to ${Utility.formatOnlyDate(topRaisers.end)}.\n\n`;

		for (let i = 0; i < topRaisers.raisers.length && i < this.RatingMaximum; ++i) {
			let d = topRaisers.raisers[i];
			message += `${this.formatPlaceWithMedal(i, true)}${d.name} raised ${d.count} times.\n`;
		}

		this.logInfo(message);
		Utility.sendMessage(channel, message);
	}

	fetchTopRaisers(channel: TextChannel, period: PeriodType): void {
		this.fetchTopRaisersAsync(channel, period).catch(err => this.logError(err));
	}

	async fetchBestLeadersAsync(channel: TextChannel, period: PeriodType): Promise<void> {
		let bestLeaders = await Statistics.fetchBestLeaders(period);

		let message = `Best leaders rating from ${Utility.formatOnlyDate(bestLeaders.start)} to ${Utility.formatOnlyDate(bestLeaders.end)}.\n\n`;

		for (let i = 0; i < bestLeaders.leaders.length && i < this.RatingMaximum; ++i) {
			let d = bestLeaders.leaders[i];
			let roundedSize = Math.round(d.totalSize / d.groupsCount);

			message += `${this.formatPlaceWithMedal(i, true)}${d.name} led ${d.realGroupsCount} groups. Average group size was ${roundedSize}. Overall score is ${Utility.formatNumber(d.score)}.\n`;
		}

		this.logInfo(message);
		Utility.sendMessage(channel, message);
	}

	fetchBestLeaders(channel: TextChannel, period: PeriodType): void {
		this.fetchBestLeadersAsync(channel, period).catch(err => this.logError(err));
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

			message += `${this.formatPlaceWithMedal(i, false)}${EmporiumProcessor.buildItemLink(d.item)} was sold ${d.count} times. Average price was ${Utility.formatNumber(roundedSize)}.\n`;
		}

		this.logInfo(message);
		Utility.sendMessage(channel, message);
	}

	fetchBestSellers(channel: TextChannel, period: PeriodType): void {
		this.fetchBestSellersAsync(channel, period).catch(err => this.logError(err));
	}

	async fetchTopMerchantsAsync(channel: TextChannel, period: PeriodType, orderBySum: boolean): Promise<void> {
		let topMerchants = await Statistics.fetchTopMerchants(period, orderBySum);

		let message = `Top merchants rating from ${Utility.formatOnlyDate(topMerchants.start)} to ${Utility.formatOnlyDate(topMerchants.end)}.\n\n`;

		for (let i = 0; i < topMerchants.merchants.length && i < this.RatingMaximum; ++i) {
			let d = topMerchants.merchants[i];

			message += `${this.formatPlaceWithMedal(i, true)}${d.name} sold ${d.count} items for the total amount of ${Utility.formatNumber(d.sum)} gold.\n`;
		}

		this.logInfo(message);
		Utility.sendMessage(channel, message);
	}

	fetchTopMerchants(channel: TextChannel, period: PeriodType, orderBySum: boolean): void {
		this.fetchTopMerchantsAsync(channel, period, orderBySum).catch(err => this.logError(err));
	}

	getTopStatsFor(stats: { [name: string]: TopStatInfo }, name: string): TopStatInfo {
		let stat: TopStatInfo = null;

		if (!(name in stats)) {
			stat = new TopStatInfo();
			stat.name = name;
			stat.deathsPlace = null;
			stat.raisersPlace = null;
			stat.leadersPlace = null;
			stat.merchantsPlace = null;
			stat.score = 0;
			stats[stat.name] = stat;
		} else {
			stat = stats[name];
		}

		return stat;
	}

	formatPlace2(result: string, place: number, name: string, k = 1): string {
		if (place == null) {
			return result;
		}

		if (result != null) {
			result += ", ";
		} else {
			result = "";
		}

		if (name != null) {
			result += `${name} `;
		}

		result += `${this.formatPlace(place)} (${(10 - place) * k})`;

		return result;
	}

	buildTopString(players: TopStatInfo[], placeGetter: (a: TopStatInfo) => number, k = 1): string {
		let result: string = null;

		// Sort by place
		players = players.sort((a, b) => placeGetter(a) - placeGetter(b));

		for (let i = 0; i < players.length; ++i) {
			let p = players[i];

			let formatName: string = null;
			if (players.length > 1) {
				formatName = p.name;
			}


			result = this.formatPlace2(result, placeGetter(p), formatName, k);
		}

		return result;
	}

	async fetchTopAsync(channel: TextChannel, period: PeriodType): Promise<void> {
		let deaths = await Statistics.fetchTopDeaths(period);
		let raisers = await Statistics.fetchTopRaisers(period);
		let leaders = await Statistics.fetchBestLeaders(period);
		let merchants = await Statistics.fetchTopMerchants(period, false);

		let stats: { [name: string]: TopStatInfo } = {};
		for (let i = 0; i < deaths.players.length && i < this.RatingMaximum; ++i) {
			let d = deaths.players[i];
			let stat = this.getTopStatsFor(stats, d.name);

			stat.deathsPlace = i;
			stat.score += (10 - i);
		}

		for (let i = 0; i < raisers.raisers.length && i < this.RatingMaximum; ++i) {
			let d = raisers.raisers[i];
			let stat = this.getTopStatsFor(stats, d.name);

			stat.raisersPlace = i;
			stat.score += (10 - i);
		}

		for (let i = 0; i < leaders.leaders.length && i < this.RatingMaximum; ++i) {
			let d = leaders.leaders[i];
			let stat = this.getTopStatsFor(stats, d.name);

			stat.leadersPlace = i;
			stat.score += 2 * (10 - i);
		}

		for (let i = 0; i < merchants.merchants.length && i < this.RatingMaximum; ++i) {
			let d = merchants.merchants[i];
			let stat = this.getTopStatsFor(stats, d.name);

			stat.merchantsPlace = i;
			stat.score += (10 - i);
		}

		// Sort by score
		var sortableArray = Object.entries(stats);
		var sortedArray = sortableArray.sort(([, a], [, b]) => b.score - a.score);

		let message = `Top rating from ${Utility.formatOnlyDate(deaths.start)} to ${Utility.formatOnlyDate(deaths.end)}.\n\n`;

		const embed = new EmbedBuilder().setDescription(message);

		let j = 0;
		for (let i = 0; i < this.RatingMaximum; ++i) {
			// Gather all adventurers with similar score
			let players: TopStatInfo[] = [];

			for (; j < sortableArray.length; ++j) {
				let p = sortedArray[j][1];
				if (players.length == 0 || players[0].score == p.score) {
					players.push(p);
				} else if (players[0].score > p.score) {
					break;
				}
			}

			if (players.length == 0) {
				// No more records
				break;
			}

			let score = players[0].score;

			let name = this.formatPlaceWithMedal(i, false);

			for (let k = 0; k < players.length; ++k) {
				let d = players[k];

				name += d.name;
				if (k < players.length - 1) {
					name += ", ";
				}
			}

			name += ` (${score})`;

			let value = "";
			let leadersString = this.buildTopString(players, p => p.leadersPlace, 2);
			if (leadersString != null) {
				value += `> Leaders: ${leadersString}\n`;
			}

			let raisersString = this.buildTopString(players, p => p.raisersPlace);
			if (raisersString != null) {
				value += `> Raisers: ${raisersString}\n`;
			}

			let merchantsString = this.buildTopString(players, p => p.merchantsPlace);
			if (merchantsString != null) {
				value += `> Merchants: ${merchantsString}\n`;
			}

			let deathsString = this.buildTopString(players, p => p.deathsPlace);
			if (deathsString != null) {
				value += `> Deaths: ${deathsString}\n`;
			}

			embed.addFields({
				name: name,
				value: value
			});
		}

		Utility.sendEmbed(channel, embed);
	}

	fetchTop(channel: TextChannel, period: PeriodType): void {
		this.fetchTopAsync(channel, period).catch(err => this.logError(err));
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
		let message = "I know following commands:\n!topdeaths [week|month|**year**|all]\n!topraisers [week|month|**year**|all]\n!bestleaders [week|month|**year**|all]\n!topmerchants [week|month|**year**|all]\n!topmerchants2 [week|month|**year**|all]\n!top [week|month|**year**|all]\n!mostdeadly [week|month|**year**|all]\n!gamestats [week|month|**year**|all]\n!bestsellers [week|month|**year**|all]\n!mostdeadlyfor player_name\n!statfor player_name [week|month|**year**|all]\n!victimsof mobile_name\n!epichistory epic_name\n";

		this.logInfo(message);
		Utility.sendMessage(channel, message);
	}

	getPeriod(parts: string[], index = 1): PeriodType {
		let result = PeriodType.Year;

		if (parts.length > index) {
			let arg = parts[index];
			if (arg == "week") {
				result = PeriodType.Week;
			} else if (arg == "month") {
				result = PeriodType.Month;
			} else if (arg == "all") {
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
			} else if (command == "topmerchants") {
				let period = this.getPeriod(parts);
				this.fetchTopMerchants(channel, period, false);
			} else if (command == "topmerchants2") {
				let period = this.getPeriod(parts);
				this.fetchTopMerchants(channel, period, true);
			} else if (command == "bestleaders") {
				let period = this.getPeriod(parts);
				this.fetchBestLeaders(channel, period);
			} else if (command == "top") {
				let period = this.getPeriod(parts);
				this.fetchTop(channel, period);
			} else if (command == "gamestats") {
				let period = this.getPeriod(parts);
				this.fetchGameStats(channel, period);
			} else if (command.startsWith("statfor") || command.startsWith("statsfor")) {
				let parts = content.split(' ');
				if (parts.length < 2) {
					Utility.sendMessage(channel, "Usage: !statfor adventurer_name");
				} else {
					let user = msg.author.username;
					let adventurer = parts[1];
					let period = this.getPeriod(parts, 2);

					if (this.checkOwnership(user, adventurer, channel)) {
						this.fetchStatFor(channel, adventurer, period);
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