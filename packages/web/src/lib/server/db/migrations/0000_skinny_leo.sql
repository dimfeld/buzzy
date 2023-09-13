CREATE TABLE `chats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text,
	`started_at` integer DEFAULT unixepoch() NOT NULL,
	`last_message_at` integer DEFAULT unixepoch() NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`chat_id` integer NOT NULL,
	`timestamp` integer DEFAULT unixepoch() NOT NULL,
	FOREIGN KEY (`chat_id`) REFERENCES `chats`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `chat_idx` ON `messages` (`chat_id`,`timestamp`);