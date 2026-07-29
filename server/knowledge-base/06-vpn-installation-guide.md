# VPN installation guide

> Source: https://uom.lk/cites/support/vpn-installation-guide
> Retrieved: 2026-07-30 · Status: SOURCED (extracted from the live CITeS page — treat the URL as authoritative for anything not covered here)

### Q: What are the UoM VPN server details?

- Server hostname: `svpn.mrt.ac.lk`
- Port: `443`
- Authentication: RADIUS or NT Domain
- Credentials: your UoM account (the same one used for LMS, Moodle, UoM_Wireless, and UoM email)

### Q: How do I install and configure the VPN client on Windows?

Download and install the SoftEther VPN Client from `https://www.softether.org/`. Create a local virtual network interface adapter, then create a connection profile using the server details above (hostname `svpn.mrt.ac.lk`, port 443, RADIUS authentication, your UoM credentials).

### Q: How do I install and configure the VPN client on Linux or Mac?

Download the appropriate SoftEther VPN Client build for your platform, extract the files, and run `make`, accepting the licence agreements. Start the client with `sudo ./vpnclient start`, then configure the connection through the `./vpncmd` interface: create a virtual network interface, create a VPN account pointing at the destination server and hub name, set authentication to RADIUS, and configure the routing table with the correct gateway and subnet mask.

### Q: Do I need to repeat the VPN setup every time?

No — creating the virtual network interface and the VPN account is a one-time setup. The one step you may need to repeat is adding a route, which should be redone whenever it is needed for a particular network destination.
