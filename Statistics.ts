import { Logger } from "winston";
import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import { Utility } from "./Utility";

const fs = require('fs');

enum EventType {
	Death,
	Raised
}

class Event {
	type: EventType;
	adventurer: string;
	doer: string;
	timeStamp: number;
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
		let dbExists = fs.existsSync(this.DbFileName);

		let result = await open({
			filename: this.DbFileName,
			driver: sqlite3.Database
		});

		// If the db file didnt exist, then create the tables
		if (!dbExists) {
			await result.exec('CREATE TABLE events(id INTEGER PRIMARY KEY, type INTEGER, adventurer TEXT, doer TEXT, timeStamp INTEGER);');
		}

		return result;
	}

	private static async logEventAsync(type: EventType, adventurer: string, doer: string): Promise<void> {
		let connection = await this.openDb();

		let timeStamp = Utility.getUnixTimeStamp();
		let cmd = `INSERT INTO events(type, adventurer, doer, timeStamp) VALUES(${type}, '${adventurer}', '${doer}', ${timeStamp})`;
		let result = await connection.run(cmd);

		await connection.close();

		let eventId = result.lastID;
		this.logInfo(`Added ${type} event #${eventId}: ${adventurer}, ${doer}, ${timeStamp}`);
	}

	static async logDeath(adventurer: string, killer: string): Promise<void> {
		return this.logEventAsync(EventType.Death, adventurer, killer);
	}

	static async logRaise(adventurer: string, raiser: string): Promise<void> {
		return this.logEventAsync(EventType.Raised, adventurer, raiser).catch(err => this.logError(err));
	}
}
