CREATE TABLE `page_views` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `page_path` text NOT NULL,
  `referrer_host` text,
  `created_at` integer NOT NULL
);
CREATE INDEX `page_views_created_at_idx` ON `page_views` (`created_at`);
CREATE INDEX `page_views_path_created_at_idx` ON `page_views` (`page_path`,`created_at`);
