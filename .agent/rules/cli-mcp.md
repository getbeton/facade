---
trigger: always_on
---

whenever possible, test all APIs (both internal ones you build and external you integrate into product) by:

- building the app to check compilation errors
- testing the endpoints locally using bash scripts and/or MCP when available
- storing

Make sure to write shell scripts for testing that will work both locally and when running a deployment in the cloud

Create a specific folder for results of the tests which should be stored only locally (e.g. with gitignore)
