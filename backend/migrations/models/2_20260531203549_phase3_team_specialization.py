from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE `features` ADD `specialization` VARCHAR(11)   COMMENT 'FRONTEND: frontend\nBACKEND: backend\nDEVOPS: devops\nINTEGRATION: integration\nTESTING: testing';
        CREATE TABLE IF NOT EXISTS `team_compositions` (
    `created_at` DATETIME(6) NOT NULL  DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL  DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `id` INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `frontend_devs` INT NOT NULL  DEFAULT 0,
    `backend_devs` INT NOT NULL  DEFAULT 0,
    `fullstack_devs` INT NOT NULL  DEFAULT 0,
    `testers` INT NOT NULL  DEFAULT 0,
    `devops` INT NOT NULL  DEFAULT 0,
    `integration_engineers` INT NOT NULL  DEFAULT 0,
    `sprint_length_weeks` INT NOT NULL  DEFAULT 2,
    `sprint_start_date` DATE,
    `project_id` INT NOT NULL UNIQUE,
    CONSTRAINT `fk_team_com_projects_0d0dede1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COMMENT='Per-project team head-counts + sprint cadence used for capacity reasoning.';"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE `features` DROP COLUMN `specialization`;
        DROP TABLE IF EXISTS `team_compositions`;"""
