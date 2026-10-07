#!/usr/bin/env python3
"""
CLI Backlog Upload Tool for Jira:
Synchronizes 4-tier Epics, User Stories (with Gherkin ACs), and Subtasks
from AI Scrum Master directly to Atlassian Jira Cloud.
"""

import sys
import os
import argparse
import json

# Ensure project root in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from apps.api.src.core.config import settings
from apps.api.src.core.firestore_client import db
from apps.api.src.core.provider_factory import provider_factory
from scripts.seed_project_data import seed

def parse_args():
    parser = argparse.ArgumentParser(description="Upload AI Scrum Master backlog to Atlassian Jira.")
    parser.add_argument("--project-id", "-p", default="proj-claims-auto", help="AI Scrum Master project ID (default: proj-claims-auto)")
    parser.add_argument("--jira-key", "-k", default="SCRUM", help="Target Jira project key (default: SCRUM)")
    parser.add_argument("--dry-run", action="store_true", help="Validate Jira connection and show backlog without uploading")
    parser.add_argument("--list", action="store_true", help="List available projects and their backlog summary")
    return parser.parse_args()

def main():
    args = parse_args()

    print("==================================================================")
    print("      AI Scrum Master — Jira Backlog Upload & Sync Tool           ")
    print("==================================================================")

    # 1. Ensure seed data exists in store if empty
    existing_projects = list(db.collection("projects").stream())
    if not existing_projects:
        print("[*] Initializing local database with sample project data...")
        seed()
        existing_projects = list(db.collection("projects").stream())

    if args.list:
        print("\nAvailable Projects:")
        for p_doc in existing_projects:
            p_data = p_doc.to_dict()
            p_id = p_doc.id
            epics = list(db.collection("epics").where("project_id", "==", p_id).stream())
            stories = list(db.collection("stories").where("project_id", "==", p_id).stream())
            tasks = list(db.collection("tasks").where("project_id", "==", p_id).stream())
            print(f"- {p_id} | {p_data.get('name')} [{p_data.get('key')}] | Epics: {len(epics)}, Stories: {len(stories)}, Tasks: {len(tasks)}")
        return

    target_project_id = args.project_id
    target_jira_key = args.jira_key.upper()

    # 2. Get and verify Jira provider
    jira_provider = provider_factory.get_jira_provider(target_project_id, target_project_key=target_jira_key)
    print(f"[*] Jira Instance: {jira_provider.instance_url}")
    print(f"[*] Target Jira Project: {target_jira_key}")

    # Check connection
    status = jira_provider.check_connection()
    if not status.get("connected"):
        print(f"\n[!] ERROR: Failed to connect to Jira: {status.get('error')}")
        print("    Ensure JIRA_INSTANCE_URL, JIRA_USER_EMAIL, and JIRA_API_TOKEN are set in .env")
        sys.exit(1)

    print(f"[✓] Connected to Jira as: {status.get('display_name')} ({status.get('email')})")

    # 3. Inspect backlog to be uploaded
    epics = list(db.collection("epics").where("project_id", "==", target_project_id).stream())
    stories = list(db.collection("stories").where("project_id", "==", target_project_id).stream())
    tasks = list(db.collection("tasks").where("project_id", "==", target_project_id).stream())

    print(f"\n[*] Discovered Backlog Items for '{target_project_id}':")
    print(f"    - Epics:    {len(epics)}")
    print(f"    - Stories:  {len(stories)}")
    print(f"    - Tasks:    {len(tasks)}")

    if not epics and not stories and not tasks:
        print("[!] No backlog items found for this project.")
        return

    for ed in epics:
        e = ed.to_dict()
        print(f"\n  [Epic] {e.get('key')}: {e.get('title')}")
        for sd in stories:
            s = sd.to_dict()
            if s.get("epic_id") == ed.id:
                print(f"    └─ [Story] {s.get('key')}: {s.get('title')} ({s.get('story_points', 5)} pts)")
                for td in tasks:
                    t = td.to_dict()
                    if t.get("story_id") == sd.id:
                        tt = t.get("task_type", "DEV")
                        tt_str = tt.value if hasattr(tt, "value") else str(tt).split(".")[-1]
                        print(f"        └─ [Task] {t.get('key')}: [{tt_str}] {t.get('title')}")

    if args.dry_run:
        print("\n[✓] Dry-run completed. No issues were created in Jira.")
        return

    # 4. Perform live Jira upload
    print(f"\n[*] Uploading backlog to Jira project '{target_jira_key}'...")
    result = jira_provider.upload_project_backlog(target_project_id, target_project_key=target_jira_key)

    print("\n==================================================================")
    print("                     Jira Upload Summary                          ")
    print("==================================================================")
    print(f"Status:             {result.get('status')}")
    print(f"Jira Project:       {result.get('jira_project_key')}")
    print(f"Epics Synced:       {result.get('total_epics_synced')}")
    print(f"Stories Synced:     {result.get('total_stories_synced')}")
    print(f"Tasks Synced:       {result.get('total_tasks_synced')}")

    if result.get("epics"):
        print("\nCreated / Synced Epics:")
        for e in result["epics"]:
            print(f"  • {e['key']}: {e['title']}")
            print(f"    Link: {e['url']}")

    if result.get("stories"):
        print("\nCreated / Synced Stories:")
        for s in result["stories"]:
            print(f"  • {s['key']} (under {s.get('parent_epic')}): {s['title']}")
            print(f"    Link: {s['url']}")

    if result.get("tasks"):
        print("\nCreated / Synced Tasks / Subtasks:")
        for t in result["tasks"]:
            print(f"  • {t['key']} (under {t.get('parent_story')}): {t['title']}")
            print(f"    Link: {t['url']}")

    if result.get("errors"):
        print("\nWarnings / Errors:")
        for err in result["errors"]:
            print(f"  [!] {err}")

    print("==================================================================")
    print("Upload complete!")

if __name__ == "__main__":
    main()
