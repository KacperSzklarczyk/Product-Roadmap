from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id` INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `action` VARCHAR(6) NOT NULL  COMMENT 'CREATE: create\nUPDATE: update\nDELETE: delete',
    `entity_type` VARCHAR(9) NOT NULL  COMMENT 'PROJECT: project\nFEATURE: feature\nMILESTONE: milestone\nMEMBER: member\nCOMMENT: comment',
    `entity_id` INT NOT NULL,
    `summary` VARCHAR(255),
    `created_at` DATETIME(6) NOT NULL  DEFAULT CURRENT_TIMESTAMP(6),
    `actor_id` INT NOT NULL,
    `project_id` INT NOT NULL,
    CONSTRAINT `fk_audit_lo_users_7e2888de` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_audit_lo_projects_a3a30bde` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COMMENT='Append-only record of every mutation. No updated_at by design.';
        CREATE TABLE IF NOT EXISTS `comments` (
    `created_at` DATETIME(6) NOT NULL  DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL  DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `id` INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `entity_type` VARCHAR(9) NOT NULL  COMMENT 'PROJECT: project\nFEATURE: feature\nMILESTONE: milestone\nMEMBER: member\nCOMMENT: comment',
    `entity_id` INT NOT NULL,
    `body` LONGTEXT NOT NULL,
    `author_id` INT NOT NULL,
    `project_id` INT NOT NULL,
    CONSTRAINT `fk_comments_users_01e082d8` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_comments_projects_34841e9d` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COMMENT='Polymorphic comment: attaches to a project / feature / milestone within a project.';
        CREATE TABLE IF NOT EXISTS `features` (
    `created_at` DATETIME(6) NOT NULL  DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL  DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `id` INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `description` LONGTEXT,
    `status` VARCHAR(11) NOT NULL  COMMENT 'BACKLOG: backlog\nIN_PROGRESS: in_progress\nDONE: done' DEFAULT 'backlog',
    `roadmap_bucket` VARCHAR(5) NOT NULL  COMMENT 'NOW: now\nNEXT: next\nLATER: later' DEFAULT 'later',
    `reach` INT NOT NULL  DEFAULT 0,
    `impact` DOUBLE NOT NULL  DEFAULT 1,
    `confidence` INT NOT NULL  DEFAULT 100,
    `effort` DOUBLE NOT NULL  DEFAULT 1,
    `position` INT NOT NULL  DEFAULT 0,
    `project_id` INT NOT NULL,
    CONSTRAINT `fk_features_projects_29e91a50` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) CHARACTER SET utf8mb4;
        CREATE TABLE IF NOT EXISTS `members` (
    `created_at` DATETIME(6) NOT NULL  DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL  DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `id` INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `role` VARCHAR(6) NOT NULL  COMMENT 'OWNER: owner\nEDITOR: editor\nVIEWER: viewer' DEFAULT 'viewer',
    `project_id` INT NOT NULL,
    `user_id` INT NOT NULL,
    UNIQUE KEY `uid_members_project_22a1c5` (`project_id`, `user_id`),
    CONSTRAINT `fk_members_projects_847eb1c0` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_members_users_632111a1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) CHARACTER SET utf8mb4;
        CREATE TABLE IF NOT EXISTS `milestones` (
    `created_at` DATETIME(6) NOT NULL  DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL  DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `id` INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `description` LONGTEXT,
    `due_date` DATE,
    `status` VARCHAR(11) NOT NULL  COMMENT 'PLANNED: planned\nIN_PROGRESS: in_progress\nCOMPLETED: completed' DEFAULT 'planned',
    `project_id` INT NOT NULL,
    CONSTRAINT `fk_mileston_projects_64742508` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) CHARACTER SET utf8mb4;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS `audit_logs`;
        DROP TABLE IF EXISTS `comments`;
        DROP TABLE IF EXISTS `features`;
        DROP TABLE IF EXISTS `members`;
        DROP TABLE IF EXISTS `milestones`;"""
