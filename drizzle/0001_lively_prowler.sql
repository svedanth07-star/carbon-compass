CREATE TABLE `carbon_calculations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`totalKg` int NOT NULL,
	`transportKg` int NOT NULL,
	`electricityKg` int NOT NULL,
	`dietKg` int NOT NULL,
	`lifestyleKg` int NOT NULL,
	`inputsJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `carbon_calculations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `carbon_goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`baselineKg` int NOT NULL,
	`targetKg` int NOT NULL,
	`targetDate` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `carbon_goals_id` PRIMARY KEY(`id`),
	CONSTRAINT `carbon_goals_userId_unique` UNIQUE(`userId`)
);
