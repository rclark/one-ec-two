# one-ec-two

Launch a single EC2. Bring your own key pair. Use https://github.com/mapbox/cfn-config.

## Launch an EC2

```
$ npm install -g cfn-config
$ git clone https://github.com/rclark/one-ec-two
$ cd one-ec-two && npm install
$ cfn-config my-ec2 cloudformation/one-ec-two.template.js -c cfn-configs
```

- Your shell must have valid AWS credentials set in the environment
- You will be asked to provide the name of an EC2 key pair, and the type of EC2 to run
- You will need to replace `cfn-configs` with the name of an S3 bucket in your account

## Connect to the EC2
Once the CloudFormation stack has launched, you can make an SSH connection to it.

```
# Find the instance's public DNS name, copy and paste it into the next command
$ cfn-config info my-ec2 | grep PublicDns
$ ssh -i ~/.ssh/my-key.pem ec2-user@ec2-12-345-678-901.compute-1.amazonaws.com
```
