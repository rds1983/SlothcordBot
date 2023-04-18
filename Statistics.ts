import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import { Utility } from "./Utility";
import { LoggerWrapper } from "./LoggerWrapper";

enum EventType {
	Death,
	Raised
}

export class BaseInfo {
	public start: number;
	public end: number;
}

export class StatInfo {
	public name: string;
	public count: number;
}

export class TopDeathsInfo extends BaseInfo {
	public players: StatInfo[];
}

export class MostDeadlyInfo extends BaseInfo {
	public deadlies: StatInfo[];
}

export class TopRaisersInfo extends BaseInfo {
	public raisers: StatInfo[];
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
		let connection = await this.openDb();

		let timeStamp = Utility.getUnixTimeStamp();
		let cmd = `INSERT INTO alerts(type, adventurer, doer, gameTime, timeStamp) VALUES(?, ?, ?, ?, ?)`;
		let result = await connection.run(cmd, [type, adventurer, doer, gameTime, timeStamp]);

		await connection.close();

		let eventId = result.lastID;

		this.logInfo(`Added ${type} alert #${eventId}: ${adventurer}, ${doer}, ${gameTime}, ${timeStamp}`);
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
		try {
			let connection = await this.openDb();
			let timeStamp = Utility.getUnixTimeStamp();
			await this.storeGroupEndedInternal(connection, leader, timeStamp);
			await connection.close();
		}
		catch (err) {
			this.logError(err);
		}
	}

	public static async storeGroupStarted(leader: string, size: number): Promise<void> {
		try {
			let timeStamp = Utility.getUnixTimeStamp();

			// End existing group
			let connection = await this.openDb();
			await this.storeGroupEndedInternal(connection, leader, timeStamp);

			// Start new one
			let cmd = `INSERT INTO groups(leader, size, started, finished) VALUES(?, ?, ?, ?)`;
			await connection.run(cmd, [leader, size, timeStamp, 0]);

			this.logInfo(`${leader} started group with size ${size} at ${timeStamp}`);


			await connection.close();
		}
		catch (err) {
			this.logError(err);
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

	public static async fetchTopDeaths(): Promise<TopDeathsInfo> {
		let connection = await this.openDb();

		let [start, end] = await this.fetchStartEndFromAlerts(connection);

		let result: TopDeathsInfo =
		{
			start: start,
			end: end,
			players: []
		};

		let cmd = `SELECT adventurer, COUNT(adventurer) AS c FROM alerts GROUP BY adventurer ORDER BY c DESC`;
		let data = await connection.all(cmd);
		if (data === undefined) {
			return;
		}

		for (let i = 0; i < data.length; ++i) {
			let row = data[i];

			let pdi: StatInfo =
			{
				name: row.adventurer,
				count: row.c
			};

			result.players.push(pdi);
		}

		return result;
	}

	public static async fetchMostDeadlies(): Promise<MostDeadlyInfo> {
		let connection = await this.openDb();

		let [start, end] = await this.fetchStartEndFromAlerts(connection);

		let result: MostDeadlyInfo =
		{
			start: start,
			end: end,
			deadlies: []
		};

		let cmd = `SELECT doer, COUNT(doer) AS c FROM alerts WHERE type = 0 GROUP BY doer ORDER BY c DESC`;
		let data = await connection.all(cmd);
		if (data === undefined) {
			return;
		}

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

	public static async fetchTopRaisers(): Promise<TopRaisersInfo> {
		let connection = await this.openDb();

		let [start, end] = await this.fetchStartEndFromAlerts(connection);

		let result: TopRaisersInfo =
		{
			start: start,
			end: end,
			raisers: []
		};

		let cmd = `SELECT doer, COUNT(doer) AS c FROM alerts WHERE type = 1 GROUP BY doer ORDER BY c DESC`;
		let data = await connection.all(cmd);
		if (data === undefined) {
			return;
		}

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
}
