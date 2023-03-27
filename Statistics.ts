import { Logger } from "winston";
import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import { Utility } from "./Utility";

enum EventType {
	Death,
	Raised
}

export class Statistics {
	private static readonly logger: Logger = Utility.createLogger("statistics");

	private static readonly DbFileName: string = "data.db";

	private static logError(message: any): void {
		this.logger.log({
			level: 'error',
			message: Utility.toString(message)
		});
	}

	private static logInfo(message: any): void {
		this.logger.log({
			level: 'info',
			message: Utility.toString(message)
		});
	}

	private static async openDb(): Promise<Database> {
		return await open({
			filename: this.DbFileName,
			driver: sqlite3.Database
		});
	}

	private static async logAlertAsync(type: EventType, adventurer: string, doer: string, gameTime: string): Promise<void> {
		let connection = await this.openDb();

		let timeStamp = Utility.getUnixTimeStamp();
		let cmd = `INSERT INTO alerts(type, adventurer, doer, gameTime, timeStamp) VALUES(?, ?, ?, ?, ?)`;
		let result = await connection.run(cmd, [type, adventurer, doer, gameTime, timeStamp]);

		await connection.close();

		let eventId = result.lastID;
		this.logInfo(`Added ${type} alert #${eventId}: ${adventurer}, ${doer}, ${gameTime}, ${timeStamp}`);
	}

	static async logDeath(adventurer: string, killer: string, gameTime: string): Promise<void> {
		return this.logAlertAsync(EventType.Death, adventurer, killer, gameTime).catch(err => this.logError(err));
	}

	static async logRaise(adventurer: string, raiser: string, gameTime: string): Promise<void> {
		return this.logAlertAsync(EventType.Raised, adventurer, raiser, gameTime).catch(err => this.logError(err));
	}

	private static async logGroupEndedInternal(connection: Database, leader: string, timeStamp: number): Promise<void> {
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


	public static async logGroupEnded(leader: string): Promise<void> {
		try {
			let connection = await this.openDb();
			let timeStamp = Utility.getUnixTimeStamp();
			await this.logGroupEndedInternal(connection, leader, timeStamp);
			await connection.close();
		}
		catch (err) {
			this.logError(err);
		}
	}

	public static async logGroupStarted(leader: string, size: number): Promise<void> {
		try {
			let timeStamp = Utility.getUnixTimeStamp();

			// End existing group
			let connection = await this.openDb();
			await this.logGroupEndedInternal(connection, leader, timeStamp);

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
}
