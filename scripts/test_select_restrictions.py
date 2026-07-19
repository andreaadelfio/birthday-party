#!/usr/bin/env python3
"""
Test script to verify that direct SELECT queries are restricted on sensitive tables.
This ensures that data cannot be accessed directly via the Supabase REST API.
"""

import json
import re
import sys
import uuid
from pathlib import Path

# Load Supabase config
config_file = Path(__file__).parent.parent / "supabase-config.js"
if not config_file.exists():
    print("Error: supabase-config.js not found")
    sys.exit(1)

config_content = config_file.read_text()

# Extract config manually
url_match = re.search(r'url:\s*["\']([^"\']+)["\']', config_content)
key_match = re.search(r'publishableKey:\s*["\']([^"\']+)["\']', config_content)

if not url_match or not key_match:
    print("Error: Could not extract url or publishableKey from config")
    sys.exit(1)

config = {
    "url": url_match.group(1),
    "publishableKey": key_match.group(1)
}

import requests

headers = {
    "apikey": config["publishableKey"],
    "Authorization": f"Bearer {config['publishableKey']}",
    "Content-Type": "application/json"
}

def debug_direct_select(table, limit=5):
    url = f"{config['url']}/rest/v1/{table}?select=*&limit={limit}"
    response = requests.get(url, headers=headers)
    content_type = response.headers.get("content-type", "<none>")

    print(f"\n--- {table} ---")
    print(f"URL: {url}")
    print(f"Status: {response.status_code}")
    print(f"Content-Type: {content_type}")

    try:
        body = response.json()
        print("Body:", json.dumps(body, indent=2, ensure_ascii=False))
    except ValueError:
        body = response.text
        print("Body:", body)

    return response.status_code, body


def create_test_registration():
    url = f"{config['url']}/rest/v1/rpc/register_guest"
    username = f"debug_{uuid.uuid4().hex[:8]}"
    payload = {
        "p_name": "Debug",
        "p_surname": "Tester",
        "p_username": username,
        "p_guests_count": 1,
        "p_notes": "Debug row for direct SELECT test.",
        "p_group_slug": "default",
        "p_new_group_name": None,
        "p_will_be_there": False
    }

    print(f"\nCreating test registration with username: {username}")
    response = requests.post(url, json=payload, headers=headers)
    print(f"RPC status: {response.status_code}")

    try:
        print("RPC body:", json.dumps(response.json(), indent=2, ensure_ascii=False))
    except ValueError:
        print("RPC body:", response.text)

    if not response.ok:
        raise RuntimeError(
            f"Could not create test registration: {response.status_code} {response.text}"
        )

    return username


def create_test_music_profile():
    url = f"{config['url']}/rest/v1/rpc/save_music_profile"
    username = f"debug_music_{uuid.uuid4().hex[:8]}"
    payload = {
        "p_name": "Debug",
        "p_surname": "Musician",
        "p_username": username,
        "p_instruments": ["guitar"],
        "p_genres": ["indie"],
        "p_collaboration_modes": ["jam"],
        "p_availability_notes": "Test music profile.",
        "p_performance_notes": "Debug session"
    }

    print(f"\nCreating test music profile with username: {username}")
    response = requests.post(url, json=payload, headers=headers)
    print(f"RPC status: {response.status_code}")

    try:
        print("RPC body:", json.dumps(response.json(), indent=2, ensure_ascii=False))
    except ValueError:
        print("RPC body:", response.text)

    if not response.ok:
        raise RuntimeError(
            f"Could not create test music profile: {response.status_code} {response.text}"
        )

    return username


def test_select_restrictions():
    """Test that SELECT queries on sensitive tables are blocked."""
    tables_to_test = ['event_registrations', 'music_profiles', 'lista_invitati']

    for table in tables_to_test:
        status, body = debug_direct_select(table)

        if status == 200:
            if isinstance(body, list) and len(body) == 0:
                print(
                    f"WARN: SELECT on {table} returned 200 with empty array. "
                    "Questa risposta non conferma la protezione RLS da sola."
                )
                if table == 'event_registrations':
                    create_test_registration()
                    status, body = debug_direct_select(table, limit=3)

                    if status == 200 and isinstance(body, list) and len(body) > 0:
                        print(
                            "FAIL: SELECT on event_registrations returned actual rows "
                            "dopo l'inserimento di una riga di test."
                        )
                        return False
                    elif status == 200 and isinstance(body, list) and len(body) == 0:
                        print(
                            "PASS: event_registrations SELECT non vede le righe create. "
                            "La tabella è nascosta dalla policy RLS."
                        )
                    elif status in [401, 403]:
                        print(
                            "PASS: event_registrations SELECT is blocked after inserting a test row."
                        )
                    else:
                        print(
                            f"UNEXPECTED: event_registrations returned {status} after insertion: {body}"
                        )
                        return False
                elif table == 'music_profiles':
                    create_test_music_profile()
                    status, body = debug_direct_select(table, limit=3)

                    if status == 200 and isinstance(body, list) and len(body) > 0:
                        print(
                            "FAIL: SELECT on music_profiles returned actual rows "
                            "dopo l'inserimento di una riga di test."
                        )
                        return False
                    elif status == 200 and isinstance(body, list) and len(body) == 0:
                        print(
                            "PASS: music_profiles SELECT non vede le righe create. "
                            "La tabella è nascosta dalla policy RLS."
                        )
                    elif status in [401, 403]:
                        print(
                            "PASS: music_profiles SELECT is blocked after inserting una riga di test."
                        )
                    else:
                        print(
                            f"UNEXPECTED: music_profiles returned {status} after insertion: {body}"
                        )
                        return False
                else:
                    print(
                        f"INFO: {table} returned no rows. Per verificare la protezione, aggiungi una riga e riprova."
                    )
                    return False
            else:
                print(f"FAIL: SELECT on {table} should be restricted but succeeded with body: {body}")
                return False
        elif status in [401, 403]:
            print(f"PASS: {table} SELECT correctly restricted ({status})")
        else:
            print(f"UNEXPECTED: SELECT on {table} returned {status}: {body}")
            return False

    return True

def test_allowed_select():
    """Test that SELECT on allowed tables works."""
    url = f"{config['url']}/rest/v1/guest_groups?select=name,slug&limit=1"
    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        print("PASS: guest_groups SELECT allowed as expected")
        return True
    else:
        print(f"FAIL: guest_groups SELECT should be allowed but got {response.status_code}: {response.text}")
        return False

if __name__ == "__main__":
    print("Testing database SELECT restrictions...")

    success = True
    success &= test_allowed_select()
    success &= test_select_restrictions()

    if success:
        print("\nAll tests passed!")
        sys.exit(0)
    else:
        print("\nSome tests failed!")
        sys.exit(1)