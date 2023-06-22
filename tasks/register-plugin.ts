import { activeContractsList } from '@aragon/osx-ethers';
import {
  PluginRepoFactory__factory
} from "@aragon/osx-ethers";

task("register-plugin", "Register the plugin in the plugin repository")
  .addParam("pluginname", "The Plugin Name")
  .addParam("contractname", "Plugin Setup Contract name to deploy")
  .addParam("mantaineraddress", "Mantainer address")
  .setAction(async (taskArgs) => {

    const signers = await ethers.getSigners();

    const PluginSetup = await ethers.getContractFactory(taskArgs.contractname);
    const pluginSetup = await PluginSetup.deploy();

    const pluginRepoFactory = PluginRepoFactory__factory.connect(
      activeContractsList.mumbai.PluginRepoFactory,
      signers[0]
    )

    await pluginSetup.deployed();

    console.log(`Plugin deployed to ${pluginSetup.address}`);

    const tx = await pluginRepoFactory.connect(
      signers[0]
    ).createPluginRepoWithFirstVersion(
      taskArgs.pluginname,
      pluginSetup.address,
      taskArgs.mantaineraddress,
      ethers.utils.hexlify(
        ethers.utils.toUtf8Bytes(`ipfs://mock`)
      ),
      ethers.utils.hexlify(
        ethers.utils.toUtf8Bytes(`ipfs://mock`)
      )
    );
    console.log(
      `Creating & registering repo for plugin with tx ${tx.hash}`
    );
    await tx.wait();

  });