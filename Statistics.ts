import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import { Utility } from "./Utility";
import { LoggerWrapper } from "./LoggerWrapper";

enum EventType {
	Death,
	Raised
}

export enum PeriodType {
	Week,
	Month,
	Year,
	AllTime
}

export class BaseInfo {
	public start: number;
	public end: number;
}

export class StatInfo {
	public name: string;
	public count: number;
}

export class TopDeathsStatInfo extends StatInfo {
	public raises: number;
}


export class TopDeathsInfo extends BaseInfo {
	public players: TopDeathsStatInfo[];
}

export class MostDeadlyInfo extends BaseInfo {
	public deadlies: TopDeathsStatInfo[];
}

export class MostDeadlyInfo2 extends BaseInfo {
	public deadlies: StatInfo[];
}

export class StatForInfo extends BaseInfo {
	public deathsCount: number;
	public wereRaisedCount: number;
	public raisedSomeoneCount: number;
	public salesCount: number;
	public salesSum: string;
}

export class TopRaisersInfo extends BaseInfo {
	public raisers: StatInfo[];
}

export class LeaderInfo {
	public name: string;
	public realGroupsCount: number = 0;
	public groupsCount: number = 0;
	public totalSize: number = 0;
	public score: number = 0;
}

export class BestLeadersInfo extends BaseInfo {
	public leaders: LeaderInfo[];
}

export class GroupInfo {
	public id: number;
	public leader: string;
}

class RealGroup {
	public rows: any[] = [];
	public started: number;
	public finished: number;
}

class RealGroupsInfo extends BaseInfo {
	public realGroups: RealGroup[];
}

export class GameStatsInfo extends BaseInfo {
	public adventurersDiedCount: number;
	public deadlyCount: number;
	public adventurersDeathsCount: number;
	public adventurersRaisedCount: number;
	public adventurersRaisersCount: number;
	public adventurersRaisesCount: number;
	public groupsCount: number;
	public epicKillsByGroup: number;
	public epicKillsSolo: number;
	public itemsSoldCount: number;
	public sellersCount: number;
	public salesSum: number;
}

export class Statistics {
	private static readonly loggerWrapper: LoggerWrapper = new LoggerWrapper("statistics");

	private static readonly DbFileName: string = "data.db";

	getName(): string {
		return "statistics";
	}

	private static logError(message: any): void {
		this.loggerWrapper.logError(message);
	}

	private static logInfo(message: any): void {
		this.loggerWrapper.logInfo(message);
	}

	private static async openDb(): Promise<Database> {
		return await open({
			filename: this.DbFileName,
			driver: sqlite3.Database
		});
	}

	private static async storeAlertAsync(type: EventType, adventurer: string, doer: string, gameTime: string): Promise<void> {
		let connection: Database = null;
		try {
			connection = await this.openDb();

			let timeStamp = Utility.getUnixTimeStamp();
			let cmd = `INSERT INTO alerts(type, adventurer, doer, gameTime, timeStamp) VALUES(?, ?, ?, ?, ?)`;
			let result = await connection.run(cmd, [type, adventurer, doer, gameTime, timeStamp]);
			let eventId = result.lastID;
			this.logInfo(`Added ${type} alert #${eventId}: ${adventurer}, ${doer}, ${gameTime}, ${timeStamp}`);
		}
		finally {
			if (connection != null) {
				await connection.close();
			}
		}
	}

	static async storeDeath(adventurer: string, killer: string, gameTime: string): Promise<void> {
		return this.storeAlertAsync(EventType.Death, adventurer, killer, gameTime).catch(err => this.logError(err));
	}

	static async storeRaise(adventurer: string, raiser: string, gameTime: string): Promise<void> {
		return this.storeAlertAsync(EventType.Raised, adventurer, raiser, gameTime).catch(err => this.logError(err));
	}

	private static async storeGroupEndedInternal(connection: Database, leader: string, timeStamp: number): Promise<void> {
		// Find last group of this leader
		let cmd = `SELECT id, size FROM groups WHERE leader = ? AND finished = 0`;
		let result = await connection.get(cmd, [leader]);
		if (result === undefined) {
			return;
		}

		cmd = `UPDATE groups SET finished = ? WHERE id = ?`;
		await connection.run(cmd, [timeStamp, result.id]);

		this.logInfo(`${leader}'s group finished at ${timeStamp}`);
	}


	public static async storeGroupEnded(leader: string): Promise<void> {
		let connection: Database = null;
		try {
			connection = await this.openDb();
			let timeStamp = Utility.getUnixTimeStamp();
			await this.storeGroupEndedInternal(connection, leader, timeStamp);
		}
		catch (err) {
			this.logError(err);
		}
		finally {
			if (connection != null) {
				await connection.close();
			}
		}
	}

	public static async storeGroupStarted(leader: string, continent: string, size: number): Promise<void> {
		let connection: Database = null;
		try {
			let timeStamp = Utility.getUnixTimeStamp();

			// End existing group
			connection = await this.openDb();
			await this.storeGroupEndedInternal(connection, leader, timeStamp);

			// Start new one
			let cmd = `INSERT INTO groups(leader, continent, size, started, finished) VALUES(?, ?, ?, ?, ?)`;
			await connection.run(cmd, [leader, continent, size, timeStamp, 0]);

			this.logInfo(`${leader} started group with size ${size} at ${timeStamp}`);
		}
		catch (err) {
			this.logError(err);
		}
		finally {
			if (connection != null) {
				await connection.close();
			}
		}
	}

	public static async getCurrentGroupInfo(): Promise<GroupInfo> {
		let connection: Database = null;
		try {
			// End existing group
			connection = await this.openDb();

			let cmd = `SELECT *, MAX(id) as maxId FROM groups`;
			let result = await connection.get(cmd);
			if (result === undefined) {
				return null;
			}

			if (result.finished != 0) {
				return null;
			}

			let groupInfo: GroupInfo =
			{
				id: result.id,
				leader: result.leader
			};

			return groupInfo;
		}
		catch (err) {
			this.logError(err);
		}
		finally {
			if (connection != null) {
				await connection.close();
			}
		}
	}

	public static async storeSale(seller: string, item: string, price: number): Promise<void> {
		let connection: Database = null;
		try {
			connection = await this.openDb();

			let timeStamp = Utility.getUnixTimeStamp();

			// Start new one
			let cmd = `INSERT INTO sales(seller, item, price, timeStamp) VALUES(?, ?, ?, ?)`;
			await connection.run(cmd, [seller, item, price, timeStamp]);

			this.logInfo(`${seller} sold ${item} for ${price} at ${timeStamp}`);
		}
		catch (err) {
			this.logError(err);
		}
		finally {
			if (connection != null) {
				await connection.close();
			}
		}
	}

	public static async storeEpicKill(epic: string, groupId: number): Promise<void> {
		let connection: Database = null;
		try {
			connection = await this.openDb();

			let timeStamp = Utility.getUnixTimeStamp();

			// Start new one
			let cmd = `INSERT INTO epic_kills(epic, groupId, timeStamp) VALUES(?, ?, ?)`;
			await connection.run(cmd, epic, groupId, timeStamp);

			if (groupId != null) {
				this.logInfo(`Group with id ${groupId} defeated epic ${epic}`);
			}
		}
		catch (err) {
			this.logError(err);
		}
		finally {
			if (connection != null) {
				await connection.close();
			}
		}
	}

	private static async fetchStartEndFromAlerts(connection: Database): Promise<[number, number]> {
		let cmd = `SELECT MIN(timestamp) as min FROM alerts`;
		let val = await connection.get(cmd);
		let start = val.min;

		cmd = `SELECT MAX(timestamp) as max FROM alerts`;
		val = await connection.get(cmd);
		let end = val.max;

		return [start, end];
	}

	private static buildPeriodFilter(period: PeriodType): number {
		let start = new Date();
		switch (period) {
			case PeriodType.Week:
				start.setDate(start.getDate() - 7);
				break;
			case PeriodType.Month:
				start.setMonth(start.getMonth() - 1);
				break;
			case PeriodType.Year:
				start.setMonth(start.getMonth() - 12);
		}


		return Utility.toUnixTimeStamp(start);
	}

	public static async fetchTopDeaths(period: PeriodType): Promise<TopDeathsInfo> {
		let connection: Database = null;

		try {
			connection = await this.openDb();

			let start = 0;
			let end = 0;
			let periodFilter = "";


			if (period == PeriodType.AllTime) {
				[start, end] = await this.fetchStartEndFromAlerts(connection);
			} else {
				start = this.buildPeriodFilter(period);
				end = Utility.getUnixTimeStamp();
				periodFilter = `AND timeStamp >= ${start} AND timeStamp <= ${end}`;

			}

			let result: TopDeathsInfo =
			{
				start: start,
				end: end,
				players: []
			};

			let cmd = `SELECT adventurer, COUNT(adventurer) AS c FROM alerts WHERE type = 0 ${periodFilter} GROUP BY adventurer ORDER BY c DESC`;
			let data = await connection.all(cmd);
			for (let i = 0; i < data.length; ++i) {
				let row = data[i];

				cmd = `SELECT COUNT(adventurer) AS c FROM alerts WHERE type = 1 AND adventurer='${row.adventurer}' ${periodFilter}`;
				let data2 = await connection.all(cmd);

				let pdi: TopDeathsStatInfo =
				{
					name: row.adventurer,
					count: row.c,
					raises: data2[0].c
				};

				result.players.push(pdi);
			}

			return result;
		}
		finally {
			if (connection != null) {
				await connection.close();
			}
		}
	}

	public static async fetchMostDeadly(period: PeriodType): Promise<MostDeadlyInfo> {
		let connection: Database = null;

		try {
			connection = await this.openDb();

			let start = 0;
			let end = 0;
			let periodFilter = "";

			if (period == PeriodType.AllTime) {
				[start, end] = await this.fetchStartEndFromAlerts(connection);
			} else {
				start = this.buildPeriodFilter(period);
				end = Utility.getUnixTimeStamp();
				periodFilter = `WHERE timeStamp >= ${start} AND timeStamp <= ${end}`;
			}

			let result: MostDeadlyInfo =
			{
				start: start,
				end: end,
				deadlies: []
			};

			let deathData: { [adventurer: string]: [number, string] } = {};
			let statData: { [mob: string]: TopDeathsStatInfo } = {};
			let cmd = `SELECT * FROM alerts ${periodFilter} ORDER BY timeStamp`;
			let data = await connection.all(cmd);
			for (let i = 0; i < data.length; ++i) {
				let row = data[i];

				// Remove old death data
				let toDelete: string[] = [];
				for (let adventurer in deathData) {
					if (row.timeStamp - deathData[adventurer][0] > 5 * 60) {
						toDelete.push(adventurer);
					}
				}

				for (let i = 0; i < toDelete.length; ++i) {
					delete deathData[toDelete[i]];
				}

				if (row.type == 0) {
					// kill
					if (!(row.doer in statData)) {
						statData[row.doer] =
						{
							name: row.doer,
							count: 0,
							raises: 0
						};
					}

					deathData[row.adventurer] = [row.timeStamp, row.doer];
					++statData[row.doer].count;
				} else if (row.type == 1) {
					// raise
					if (row.adventurer in deathData) {
						let doer = deathData[row.adventurer][1];
						if (!(doer in statData)) {
							statData[doer] =
							{
								name: doer,
								count: 0,
								raises: 0
							};
						}

						++statData[doer].raises;

						delete deathData[row.adventurer];
					}
				}
			}

			// Set result
			for (let mob in statData) {
				result.deadlies.push(statData[mob]);
			}

			// Sort by kills count
			result.deadlies.sort((a, b) => {
				return b.count - a.count;
			});


			return result;
		}
		finally {
			if (connection != null) {
				await connection.close();
			}
		}
	}

	public static async fetchMostDeadlyFor(character: string): Promise<MostDeadlyInfo2> {
		let connection: Database = null;

		try {
			connection = await this.openDb();

			let [start, end] = await this.fetchStartEndFromAlerts(connection);

			let result: MostDeadlyInfo2 =
			{
				start: start,
				end: end,
				deadlies: []
			};

			// character should be passed as parameter, but for some reason it generates SQLITE_RANGE error
			let cmd = `SELECT doer, COUNT(doer) AS c FROM alerts WHERE type = 0 AND adventurer = '${character}' COLLATE NOCASE GROUP BY doer ORDER BY c DESC`;
			let data = await connection.all(cmd);
			for (let i = 0; i < data.length; ++i) {
				let row = data[i];

				let ki: StatInfo =
				{
					name: row.doer,
					count: row.c
				};

				result.deadlies.push(ki);
			}

			return result;
		}
		finally {
			if (connection != null) {
				await connection.close();
			}
		}
	}

	public static async fetchStatFor(character: string): Promise<StatForInfo> {
		let connection: Database = null;

		try {
			connection = await this.openDb();

			let [start, end] = await this.fetchStartEndFromAlerts(connection);

			let cmd = `SELECT COUNT(id) AS c FROM alerts WHERE type = 0 AND adventurer = '${character}' COLLATE NOCASE`;
			let data = await connection.all(cmd);

			let deathsCount = data[0].c;

			cmd = `SELECT COUNT(id) AS c FROM alerts WHERE type = 1 AND adventurer = '${character}' COLLATE NOCASE`;
			data = await connection.all(cmd);

			let wereRaisedCount = data[0].c;

			cmd = `SELECT COUNT(id) AS c FROM alerts WHERE type = 1 AND doer = '${character}' COLLATE NOCASE`;
			data = await connection.all(cmd);

			let raisedSomeoneCount = data[0].c;

			cmd = `SELECT COUNT(id) as c, SUM(price) AS s FROM sales WHERE seller = '${character}' COLLATE NOCASE`;
			data = await connection.all(cmd);

			let salesCount = data[0].c;
			let salesSum = data[0].s != null ? Utility.formatNumber(data[0].s) : "0";

			let result: StatForInfo =
			{
				start: start,
				end: end,
				deathsCount: deathsCount,
				wereRaisedCount: wereRaisedCount,
				raisedSomeoneCount: raisedSomeoneCount,
				salesCount: salesCount,
				salesSum: salesSum
			};

			return result;
		}
		finally {
			if (connection != null) {
				await connection.close();
			}
		}
	}

	public static async fetchTopRaisers(period: PeriodType): Promise<TopRaisersInfo> {
		let connection: Database = null;

		try {
			connection = await this.openDb();

			let start = 0;
			let end = 0;
			let periodFilter = "";

			if (period == PeriodType.AllTime) {
				[start, end] = await this.fetchStartEndFromAlerts(connection);
			} else {
				start = this.buildPeriodFilter(period);
				end = Utility.getUnixTimeStamp();
				periodFilter = `AND timeStamp >= ${start} AND timeStamp <= ${end}`;
			}

			let result: TopRaisersInfo =
			{
				start: start,
				end: end,
				raisers: []
			};

			let cmd = `SELECT doer, COUNT(doer) AS c FROM alerts WHERE type = 1 ${periodFilter} GROUP BY doer ORDER BY c DESC`;
			let data = await connection.all(cmd);
			for (let i = 0; i < data.length; ++i) {
				let row = data[i];

				let ki: StatInfo =
				{
					name: row.doer,
					count: row.c
				};

				result.raisers.push(ki);
			}

			return result;
		}
		finally {
			if (connection != null) {
				await connection.close();
			}
		}
	}

	private static async fetchRealGroups(connection: Database): Promise<RealGroupsInfo> {
		// Fetch all data
		let cmd = `SELECT leader, size, started, finished FROM groups WHERE size > 2 ORDER BY id`;
		let data = await connection.all(cmd);

		// First run: group all data by real groups
		let realGroups: RealGroup[] = [];
		let start: number = null;
		let end: number = null;
		for (let i = 0; i < data.length; ++i) {
			let row = data[i];

			if (row.finished == 0) {
				// Ignore ongoing groups
				continue;
			}

			if (start == null || row.started < start) {
				start = row.started;
			}

			if (end == null || row.finished > end) {
				end = row.finished;
			}

			// Find the group this row could be continuation of
			// Check last 4 groups
			let realGroup: RealGroup = null;
			for (let j = realGroups.length - 1; j >= Math.max(0, realGroups.length - 4); --j) {
				if (Math.abs(realGroups[j].finished - row.started) < 8) {
					// Found
					realGroup = realGroups[j];
					break;
				}
			}

			if (realGroup == null) {
				realGroup = new RealGroup();
				realGroup.started = row.started;
				realGroups.push(realGroup);
			}

			realGroup.rows.push(row);
			realGroup.finished = row.finished;
		}

		let result: RealGroupsInfo = {
			start: start,
			end: end,
			realGroups: realGroups
		}

		return result;
	}

	public static async fetchBestLeaders(): Promise<BestLeadersInfo> {
		let connection: Database = null;

		try {
			connection = await this.openDb();

			// First run: group all data by real groups
			let realGroups = await this.fetchRealGroups(connection);

			// Second run: build up statistics
			let stats: { [leader: string]: LeaderInfo } = {};
			for (let i = 0; i < realGroups.realGroups.length; ++i) {
				let realGroup = realGroups.realGroups[i];
				let leadersMask: { [leader: string]: boolean } = {};
				for (let j = 0; j < realGroup.rows.length; ++j) {
					let row = realGroup.rows[j];
					let leaderInfo: LeaderInfo;

					if (row.leader in stats) {
						leaderInfo = stats[row.leader];
					} else {
						leaderInfo = new LeaderInfo();
						leaderInfo.name = row.leader;
						stats[row.leader] = leaderInfo;
					}

					if (!(row.leader in leadersMask)) {
						leadersMask[row.leader] = true;
						++leaderInfo.realGroupsCount;
					}

					++leaderInfo.groupsCount;
					leaderInfo.totalSize += row.size;

					let leadTimeInSeconds = row.finished - row.started;

					// Single row leads should receive at least 30 mins of time to balance out website groups sync issues
					let singleRowLead = false;
					if (j < realGroup.rows.length - 1 && realGroup.rows[j + 1].leader != row.leader) {
						singleRowLead = true;
					} else if (j > 0 && j == realGroup.rows.length - 1 && realGroup.rows[j - 1].leader != row.leader) {
						singleRowLead = true;
					}

					if (singleRowLead && leadTimeInSeconds < 30 * 60) {
						leadTimeInSeconds = 30 * 60;
					}

					let score = Math.round(Math.sqrt(leadTimeInSeconds) * row.size);
					leaderInfo.score += score;
				}
			}

			// Sort by score
			var sortableArray = Object.entries(stats);
			var sortedArray = sortableArray.sort(([, a], [, b]) => b.score - a.score);

			let result: BestLeadersInfo =
			{
				start: realGroups.start,
				end: realGroups.end,
				leaders: []
			};

			for (let i = 0; i < sortedArray.length; ++i) {
				result.leaders.push(sortedArray[i][1]);
			}

			return result;
		}
		finally {
			if (connection != null) {
				await connection.close();
			}
		}
	}

	public static async fetchGameStats(period: PeriodType): Promise<GameStatsInfo> {
		let connection: Database = null;

		try {
			let result: GameStatsInfo =
			{
				start: 0,
				end: 0,
				adventurersDiedCount: 0,
				deadlyCount: 0,
				adventurersDeathsCount: 0,
				adventurersRaisedCount: 0,
				adventurersRaisersCount: 0,
				adventurersRaisesCount: 0,
				groupsCount: 0,
				epicKillsByGroup: 0,
				epicKillsSolo: 0,
				itemsSoldCount: 0,
				sellersCount: 0,
				salesSum: 0
			};

			connection = await this.openDb();

			let start = 0;
			let end = 0;
			let periodFilter = "";
			let periodFilterWithoutAnd = "";

			if (period == PeriodType.AllTime) {
				[start, end] = await this.fetchStartEndFromAlerts(connection);
			} else {
				start = this.buildPeriodFilter(period);
				end = Utility.getUnixTimeStamp();
				let str = `timeStamp >= ${start} AND timeStamp <= ${end}`;
				periodFilter = `AND ${str}`;
				periodFilterWithoutAnd = `WHERE ${str}`;
			}

			result.start = start;
			result.end = end;

			let cmd = `SELECT COUNT(DISTINCT adventurer) as c FROM alerts WHERE type=0 ${periodFilter}`;
			let data = await connection.all(cmd);

			result.adventurersDiedCount = data[0].c;

			cmd = `SELECT COUNT(DISTINCT doer) as c FROM alerts WHERE type=0 ${periodFilter}`;
			data = await connection.all(cmd);
			result.deadlyCount = data[0].c;

			cmd = `SELECT COUNT(id) as c FROM alerts WHERE type=0 ${periodFilter}`;
			data = await connection.all(cmd);

			result.adventurersDeathsCount = data[0].c;

			cmd = `SELECT COUNT(DISTINCT adventurer) as c FROM alerts WHERE type=1 ${periodFilter}`;
			data = await connection.all(cmd);

			result.adventurersRaisedCount = data[0].c;

			cmd = `SELECT COUNT(DISTINCT doer) as c FROM alerts WHERE type=1 ${periodFilter}`;
			data = await connection.all(cmd);

			result.adventurersRaisersCount = data[0].c;

			cmd = `SELECT COUNT(id) as c FROM alerts WHERE type=1 ${periodFilter}`;
			data = await connection.all(cmd);

			result.adventurersRaisesCount = data[0].c;

			let realGroups = await this.fetchRealGroups(connection);
			if (period != PeriodType.AllTime)
			{
				for (let i = 0; i < realGroups.realGroups.length; ++i) {
					let realGroup = realGroups.realGroups[i];

					if (realGroup.started >= start && realGroup.finished <= end) {
						++result.groupsCount;
					}
				}
			} else {
				result.groupsCount = realGroups.realGroups.length;
			}

			cmd = `SELECT COUNT(id) as c FROM epic_kills WHERE groupId IS NOT NULL ${periodFilter}`;
			data = await connection.all(cmd);

			result.epicKillsByGroup = data[0].c;

			cmd = `SELECT COUNT(id) as c FROM epic_kills WHERE groupId IS NULL ${periodFilter}`;
			data = await connection.all(cmd);

			result.epicKillsSolo = data[0].c;

			cmd = `SELECT COUNT(id) as c FROM sales ${periodFilterWithoutAnd}`;
			data = await connection.all(cmd);

			result.itemsSoldCount = data[0].c;

			cmd = `SELECT COUNT(DISTINCT seller) as c FROM sales ${periodFilterWithoutAnd}`;
			data = await connection.all(cmd);

			result.sellersCount = data[0].c;

			cmd = `SELECT SUM(price) as c FROM sales ${periodFilterWithoutAnd}`;
			data = await connection.all(cmd);

			result.salesSum = data[0].c;

			return result;
		}
		finally {
			if (connection != null) {
				await connection.close();
			}
		}
	}
}
