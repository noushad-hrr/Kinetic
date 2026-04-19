# Google Sheets Setup Guide

## Step 1 – Create the Spreadsheet

1. Go to sheets.google.com → New spreadsheet
2. Rename it: **Kinetic DB**

## Step 2 – Create these Sheet Tabs (in order)

Right-click a tab → Rename. Create each tab:

| Tab Name | Purpose |
|---|---|
| roles | Role master |
| users | User accounts |
| status_master | Task/Project statuses |
| priority_master | Priority levels |
| task_type_master | Task types |
| projects | Projects data |
| tasks_manager_project_artifacts | Project artifacts |
| tasks_manager_task_artifacts | Task artifacts |
| tasks_manager_tasks | Tasks data |
| user_project_permissions | User–Project access mapping |

## Step 3 – Paste Headers + Data

### Tab: roles
```
role_id | role_name | role_description
R001 | admin | Full access to all features and data
R002 | manager | Can manage projects and tasks for assigned projects
R003 | contributor | Can create and update tasks on assigned projects
R004 | viewer | Read-only access to assigned projects
```

### Tab: users
```
user_id | username | password_hash | display_name | email | role_id | is_active | created_on | last_login_on
U001 | admin | admin123 | Alex Sterling | admin@kinetic.com | R001 | TRUE | 2024-01-01 |
U002 | sarah.j | sarah123 | Sarah Johnson | sarah.j@kinetic.com | R002 | TRUE | 2024-01-05 |
U003 | liam.n | liam123 | Liam Nguyen | liam.n@kinetic.com | R003 | TRUE | 2024-01-10 |
U004 | priya.k | priya123 | Priya Kumar | priya.k@kinetic.com | R003 | TRUE | 2024-02-01 |
U005 | james.h | james123 | James Hart | james.h@kinetic.com | R004 | TRUE | 2024-02-15 |
```

### Tab: status_master
```
status_id | status_name | status_label | applies_to | sort_order
S001 | triage | Triage | both | 1
S002 | open | Open | both | 2
S003 | in_progress | In Progress | both | 3
S004 | in_review | In Review | task | 4
S005 | on_hold | On Hold | both | 5
S006 | closed | Closed | both | 6
S007 | completed | Completed | both | 7
```

### Tab: priority_master
```
priority_id | priority_name | priority_label | sort_order
P001 | very_high | Very High | 1
P002 | high | High | 2
P003 | medium | Medium | 3
P004 | low | Low | 4
```

### Tab: task_type_master
```
type_id | type_name | type_label
T001 | feature | Feature
T002 | bug | Bug
T003 | improvement | Improvement
T004 | research | Research
T005 | documentation | Documentation
T006 | design | Design
T007 | devops | DevOps
```

### Tab: projects
```
project_id | project_name | project_description | project_status | project_start_date | project_end_date | created_by | created_on | last_modified_by | last_modified_on
K-2024-001 | Kinetic App Redesign | Revamping core typography and layout systems for Q3 release. | in_progress | 2024-10-12 | 2024-12-15 | U001 | 2024-10-01 | U001 | 2024-10-20
K-2024-042 | Editorial Content Pipeline | Middleware development for CRM data synchronization. | completed | 2024-09-01 | 2024-10-30 | U001 | 2024-08-25 | U002 | 2024-10-30
K-2024-089 | Mobile App Beta | Internal testing phase for iOS and Android native workspace. | on_hold | 2024-11-20 | 2025-01-15 | U002 | 2024-11-01 | U002 | 2024-11-15
```

### Tab: tasks_manager_project_artifacts
```
tasks_manager_project_artifacts_id | tasks_manager_project_artifacts_id_fk | artifact_title | artifact_value | artifact_type | description | is_sensitive | created_by | created_on
PA0001 | K-2024-001 | Figma Design Link | https://figma.com/file/kinetic-redesign | url | | FALSE | U001 | 2024-10-12
PA0002 | K-2024-001 | API Staging URL | https://staging-api.kinetic.com | url | | FALSE | U001 | 2024-10-12
PA0003 | K-2024-001 | DB Password | super_secret_db_pass_123 | text | | TRUE | U001 | 2024-10-12
PA0004 | K-2024-042 | Jira Board | https://jira.kinetic.com/editorial | url | | FALSE | U002 | 2024-09-01
```

### Tab: user_project_permissions
```
mapping_id | user_id_fk | project_id_fk | can_read | can_create | can_update | can_delete
M001 | U001 | K-2024-001 | TRUE | TRUE | TRUE | TRUE
M002 | U001 | K-2024-042 | TRUE | TRUE | TRUE | TRUE
M003 | U001 | K-2024-089 | TRUE | TRUE | TRUE | TRUE
M004 | U002 | K-2024-001 | TRUE | TRUE | TRUE | FALSE
M005 | U002 | K-2024-042 | TRUE | TRUE | TRUE | FALSE
M006 | U002 | K-2024-089 | TRUE | TRUE | TRUE | FALSE
M007 | U003 | K-2024-001 | TRUE | TRUE | TRUE | FALSE
M008 | U003 | K-2024-042 | TRUE | FALSE | FALSE | FALSE
M009 | U004 | K-2024-001 | TRUE | TRUE | TRUE | FALSE
M010 | U005 | K-2024-001 | TRUE | FALSE | FALSE | FALSE
M011 | U005 | K-2024-042 | TRUE | FALSE | FALSE | FALSE
```

### Tab: tasks_manager_tasks
```
task_id | project_id_fk | task_title | task_remarks | task_status | task_assignees | task_start_date | task_end_date | task_start_time | task_end_time | task_order_id | type_id | priority_id | estimated_hours | spent_hours | created_by | created_on | last_modified_by | last_modified_on
KT-1001 | K-2024-001 | Implement authentication middleware | Secure all API endpoints with JWT verification. | in_progress | U003|U004 | 2024-10-15 | 2024-10-20 | 09:00 | 18:00 | 1 | T001 | P001 | 12 | 8 | U001 | 2024-10-15 | U003 | 2024-10-18
KT-1002 | K-2024-001 | Redesign billing dashboard | Update billing UI to match new design tokens. | in_review | U003 | 2024-10-18 | 2024-10-24 | 10:00 | 17:00 | 2 | T006 | P003 | 16 | 4 | U001 | 2024-10-18 | U003 | 2024-10-22
KT-1003 | K-2024-001 | API Documentation update | | triage | | | | | | 3 | T005 | P004 | 4 | 0 | U001 | 2024-10-20 | |
KT-1004 | K-2024-001 | Setup CI/CD pipeline | Configure GitHub Actions for deployment. | open | U004 | 2024-10-22 | 2024-10-30 | 09:00 | 17:00 | 4 | T007 | P002 | 8 | 2 | U001 | 2024-10-22 | U004 | 2024-10-23
KT-1005 | K-2024-042 | Update navigation schema | Refactor navigation for new editorial sections. | completed | U003 | 2024-09-05 | 2024-09-15 | 09:00 | 17:00 | 1 | T001 | P002 | 6 | 6 | U002 | 2024-09-05 | U003 | 2024-09-15
```

## Step 4 – Share Spreadsheet ID

1. Note your spreadsheet URL: `https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit`
2. Copy the `YOUR_SPREADSHEET_ID` part — you'll need it for Apps Script
