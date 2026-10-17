"""Compatibility entry point: use the application's approved queue."""
import sys
import os
if os.getenv("PUBLICATION_MODE") == "queue":
    from publish_queue import main
else:
    from run_due_publications import main

if __name__ == "__main__":
    sys.exit(main())
