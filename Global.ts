export class Config
{
	token: string;
	excludeFromAlert: string[];
}

export class Global
{
	static config: Config;
}