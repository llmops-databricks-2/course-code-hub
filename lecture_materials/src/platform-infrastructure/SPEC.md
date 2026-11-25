# Spec: the request-path drawing

The drawing of view 1 of `lecture_materials/PLATFORM-UNDER-THE-WORKSPACE.html` and the first figure of the
platform lecture. It is spliced into the page between `<!--request-path:start-->` and
`<!--request-path:end-->`; the study guide and the slides embed the same fragment.

## The claim

An action you take runs in three places that are not your machine: the **control plane** (Databricks'
backend services, in Databricks' cloud account), the **compute plane** (serverless here, also in
Databricks' cloud account, same region; classic compute would run in *your* cloud account), and
**storage**. Data is read where it lives, in parallel; the result comes back either through the control
plane or, when large, as files downloaded straight from storage.

## Layout

Columns, left to right (primary flow), inside frames that say whose cloud account holds them:

| Column | Frame | Nodes, top to bottom |
|---|---|---|
| 1. Your side | "Your machine and GitHub" (plain, outside every cloud frame) | `browser`, `client`, `github` |
| 2. Control plane | inside the frame "AWS · Databricks' account · us-west-2" | `webapp`, `scheduler`, `uc`, `cpresults` |
| 3. Serverless compute plane | same frame | `driver`, then `exec` drawn as three stacked, slightly offset cards (one node) |
| 4. Storage | same frame | `data`, `wsstore` |

Below the Databricks frame, a dashed, muted frame "Your own AWS account (classic workspaces only; not used
in the course)" holding two ghost nodes, `classic` and `bucket`, with no edges. It shows where the cloud
provider and the customer account would stand in a classic workspace.

## Nodes

Kind decides the tint (the page tokens): **person/client** = panel white with `--line` border;
**platform service** = blue (`--blue-bg`, `--blue-bd`); **compute** = blue with a solid darker border;
**stored data** = sage (`--sage-bg`, `--sage-bd`); **ghost** = panel with dashed `--line` border, muted
text.

| id | kind | title | subtitle (one line, ≤ 40 chars) |
|---|---|---|---|
| `browser` | person | Your browser | workspace UI, notebooks, SQL editor |
| `client` | person | Your laptop | SQL connector, CLI, SDK |
| `github` | person | GitHub Actions | your CD workflow |
| `webapp` | service | Web application and REST APIs | sign-in, workspace objects |
| `scheduler` | service | Jobs service | triggers and schedules runs |
| `uc` | service | Unity Catalog | privileges, lineage, audit |
| `cpresults` | data | Small results | kept in the control plane |
| `driver` | compute | Driver or SQL warehouse | plans the work, Photon |
| `exec` | compute | Executors | tasks run in parallel |
| `data` | data | Your tables and volumes | Delta and Parquet files |
| `wsstore` | data | Workspace storage | job results, large results |
| `classic` | ghost | Classic compute | clusters in your VPC |
| `bucket` | ghost | Your S3 bucket | workspace storage, classic |

## Edges

Every edge carries `data-edge="<id>"`, `data-from` and `data-to`. Labels are 11 px, in a gutter, never on
a line. Grey until lit.

| id | from → to | label |
|---|---|---|
| `e_ui` | browser → webapp | HTTPS: UI and REST |
| `e_sql` | client → webapp | HTTPS: host + http_path |
| `e_cd` | github → webapp | REST call as a principal |
| `e_sched` | webapp → scheduler | create a run |
| `e_run` | scheduler → driver | start the job's compute |
| `e_cmd` | webapp → driver | command or query (cloud backbone) |
| `e_auth` | driver → uc | may this identity read it? |
| `e_tasks` | driver → exec | split into tasks |
| `e_read` | exec → data | read files in parallel |
| `e_small` | driver → cpresults | small result |
| `e_back` | cpresults → webapp | |
| `e_reply_ui` | webapp → browser | result in the page (return path, drawn under `e_ui`) |
| `e_reply_cli` | webapp → client | result rows (return path, drawn under `e_sql`) |
| `e_large` | driver → wsstore | large result as files |
| `e_fetch` | wsstore → client | presigned URL download (Cloud Fetch) |
| `e_large_ui` | wsstore → webapp | read back for the page |

`e_fetch` is the one edge that leaves the Databricks frame from storage straight to the client: draw it
so that is visible (it runs along the bottom of the frame and up to `client`). Return edges run right
to left under their outbound twins, so no arrow crosses a box.

## What the page does with it

The page lights a sequence of edges and nodes per scenario (notebook cell, SQL from a laptop, job from
CD) and per result size. The fragment holds hooks only (`data-node`, `data-edge`, `data-from`,
`data-to`); no script. Clicking a node is handled by the page.

## Evidence (for the box descriptions, kept in `page.js`)

- Control plane, web application, serverless vs classic compute plane, default storage, workspace storage
  contents: docs `getting-started/high-level-architecture`.
- Serverless traffic over the cloud backbone: `security/network/serverless-network-security`.
- Driver and executors: `compute/configure`; Photon: `compute/photon`.
- Small results in the control plane, large in workspace storage, job results always in storage:
  `admin/workspace-settings/notebook-results`.
- Cloud Fetch above 1 MB, presigned URLs, Arrow files up to 20 MB: `integrations/odbc/capability`.
- The jobs service running in the control plane and the exact credential hand-off from Unity Catalog to
  Databricks' own compute are **not** stated in the docs: the page says so where it shows them.
