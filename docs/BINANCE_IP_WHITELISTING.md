# Binance API IP Whitelisting Guide

This guide explains how to find your local development IP and AWS API's public IP address, and configure them in Binance for API access.

## Overview

- **Local Development**: When testing locally, Binance sees your **local public IP address** (from your ISP)
- **AWS Production**: Your API runs on AWS ECS Fargate in **private subnets**. All outbound traffic (including Binance API requests) goes through a **NAT Gateway** with a static **Elastic IP (EIP)**. This EIP is the IP address that Binance will see for all API requests from AWS.

## Finding Your Local IP Address (for Local Development)

When testing locally, you need to whitelist your **public IP address** (the one your ISP assigns to your internet connection).

### Quick Method (Recommended)

```bash
# Get your current public IP address
curl https://api.ipify.org

# Or using alternative service
curl https://ifconfig.me
curl https://icanhazip.com
```

### Using a Browser

Visit any of these websites:
- https://api.ipify.org
- https://whatismyipaddress.com
- https://www.whatismyip.com

### Important Notes for Local Development

- ⚠️ **Your local IP may change** if you:
  - Restart your router/modem
  - Have a dynamic IP from your ISP
  - Connect from a different network (home vs office vs coffee shop)
- ⚠️ **If your IP changes**, you'll need to update the whitelist in Binance
- ⚠️ **Consider using a VPN** with a static IP if you need a stable IP for development

## Finding Your AWS IP Address (for Production)

### Method 1: Using Terraform Output (Recommended)

If you've deployed with Terraform, get the IP address directly:

```bash
cd infra/terraform
terraform output -raw nat_gateway_public_ip
```

This will output the IP address you need to whitelist in Binance.

### Method 2: Using AWS CLI

If you know your project name, you can find the NAT Gateway EIP:

```bash
# Get the NAT Gateway ID
NAT_GW_ID=$(aws ec2 describe-nat-gateways \
  --filter "Name=tag:Name,Values=financial-helper-nat" \
  --query 'NatGateways[0].NatGatewayId' \
  --output text)

# Get the Elastic IP associated with the NAT Gateway
aws ec2 describe-addresses \
  --filters "Name=network-interface-id,Values=$(aws ec2 describe-nat-gateways \
    --nat-gateway-ids $NAT_GW_ID \
    --query 'NatGateways[0].NatGatewayAddresses[0].NetworkInterfaceId' \
    --output text)" \
  --query 'Addresses[0].PublicIp' \
  --output text
```

Or more simply, if you know the EIP tag name:

```bash
aws ec2 describe-addresses \
  --filters "Name=tag:Name,Values=financial-helper-nat-eip" \
  --query 'Addresses[0].PublicIp' \
  --output text
```

### Method 3: Using AWS Console

1. Go to **EC2** → **Elastic IPs**
2. Find the Elastic IP with tag `Name: financial-helper-nat-eip`
3. Copy the **Public IP** address

### Method 4: Test from Your API

You can also make a test request from your API to see what IP Binance sees:

```bash
# From your local machine, trigger a test request
curl -X POST http://$(terraform output -raw api_url)/v1/binance/test-ip

# Or check CloudWatch logs after making a Binance API call
aws logs tail /ecs/financial-helper-api --follow
```

## Configuring IP Whitelisting in Binance

1. **Log in to Binance**:
   - Go to [Binance.com](https://www.binance.com) (or your testnet environment)
   - Navigate to **API Management**

2. **Edit your API key**:
   - Find the API key you're using for the bot
   - Click **Edit** or **Restrict Access**

3. **Add IP whitelist**:
   - Enable **Restrict access to trusted IPs only**
   - Add **both** IP addresses:
     - Your **local public IP** (for local development/testing)
     - Your **AWS NAT Gateway IP** (for production)
   - You can add multiple IPs (one per line or comma-separated)
   - Click **Save**

4. **Important Notes**:
   - ⚠️ **Wait 5-10 minutes** after adding the IP for changes to take effect
   - ⚠️ If you have multiple NAT Gateways (multi-AZ), you need to whitelist **all** of them
   - ⚠️ The AWS IP is **static** (Elastic IP), so it won't change unless you recreate the NAT Gateway
   - ⚠️ Your **local IP may change** - if it does, update the whitelist in Binance

## Verifying the Configuration

After whitelisting, test your Binance API connection:

### Testing Locally

```bash
# Make a test API call from your local machine
# (assuming your API is running locally on port 8080)
curl -X GET http://localhost:8080/v1/binance/balances

# Or if using a different port
curl -X GET http://localhost:3000/v1/binance/balances
```

### Testing on AWS

```bash
# Make a test API call through your AWS API
curl -X GET http://$(terraform output -raw api_url)/v1/binance/balances

# Check CloudWatch logs for any IP-related errors
aws logs tail /ecs/financial-helper-api --follow
```

If you see errors like:
- `IP address is not whitelisted`
- `Invalid API-key, IP, or permissions for action`

Then:
1. Double-check the IP address is correct
2. Wait a few more minutes for Binance to propagate the change
3. Verify the IP is added correctly in Binance API settings

## Multiple NAT Gateways (Multi-AZ Setup)

If you're running in multiple availability zones, you may have multiple NAT Gateways. In that case:

1. **Get all NAT Gateway IPs**:
   ```bash
   aws ec2 describe-addresses \
     --filters "Name=tag:Name,Values=financial-helper-nat-eip*" \
     --query 'Addresses[*].PublicIp' \
     --output text
   ```

2. **Whitelist all IPs** in Binance (comma-separated or one per line)

## Troubleshooting

### IP Address Changed

If your IP address changes (shouldn't happen with Elastic IPs), you'll need to:
1. Get the new IP address using one of the methods above
2. Update the whitelist in Binance
3. Wait 5-10 minutes for propagation

### Still Getting IP Errors

1. **Verify the IP is correct**:
   ```bash
   # Test what IP your local machine uses
   curl https://api.ipify.org
   
   # Test what IP your AWS API uses for outbound requests
   # (from inside your ECS task or check CloudWatch logs)
   curl http://api.ipify.org
   ```
   
2. **Check if your local IP changed**:
   ```bash
   # Get your current public IP
   curl https://api.ipify.org
   
   # Compare with what's whitelisted in Binance
   # If different, update the whitelist
   ```

3. **Check Binance API key settings**:
   - Ensure "Restrict access to trusted IPs only" is enabled
   - Verify the IP is added correctly (no typos, correct format)
   - Check if there are any other restrictions (API permissions, etc.)

4. **Check CloudWatch logs**:
   ```bash
   aws logs tail /ecs/financial-helper-api --follow
   ```
   Look for Binance API errors and correlation IDs.

### Testing IP from ECS Task

If you need to verify the IP from inside your ECS task:

```bash
# Get a shell in your running ECS task (requires AWS Systems Manager Session Manager)
aws ecs execute-command \
  --cluster financial-helper-cluster \
  --task <TASK_ID> \
  --container api \
  --command "/bin/sh" \
  --interactive

# Then inside the container:
curl http://api.ipify.org
```

## Local Development Tips

### Using a Static IP for Development

If your local IP changes frequently, consider:

1. **Use a VPN with static IP** (e.g., NordVPN, ExpressVPN with dedicated IP)
2. **Use a cloud development environment** (e.g., AWS Cloud9, GitHub Codespaces)
3. **Use a VPS** with a static IP for development
4. **Check your ISP** - some offer static IP addresses for an additional fee

### Testing with Binance Testnet

For local development, consider using **Binance Testnet** which may have less strict IP requirements:

- Testnet API: `https://testnet.binance.vision`
- Testnet Futures API: `https://testnet.binancefuture.com`
- Testnet API keys: Create separate keys in testnet environment

This way you can test locally without worrying about IP whitelisting affecting your production keys.

## Security Best Practices

1. **Always use IP whitelisting** for production Binance API keys
2. **Use separate API keys** for:
   - Paper trading vs live trading
   - Local development vs production
   - Different environments (testnet vs mainnet)
3. **Rotate API keys** periodically
4. **Monitor API usage** in Binance dashboard
5. **Set appropriate API permissions** (read-only for monitoring, trading for bot)
6. **Never commit API keys** to version control
7. **Use environment variables** for API keys in local development

## References

- [Binance API Documentation - IP Whitelist](https://binance-docs.github.io/apidocs/spot/en/#ip-access-restriction-on-api-key)
- [AWS NAT Gateway Documentation](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html)
- [AWS Elastic IP Documentation](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html)

