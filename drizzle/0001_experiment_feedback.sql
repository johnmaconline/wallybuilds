CREATE TABLE `experiment_events` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `experiment_slug` text NOT NULL,
  `event_type` text NOT NULL,
  `created_at` integer NOT NULL
);
CREATE INDEX `experiment_events_slug_type_created_at_idx` ON `experiment_events` (`experiment_slug`,`event_type`,`created_at`);
