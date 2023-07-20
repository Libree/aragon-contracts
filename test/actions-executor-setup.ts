import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { ActionsExecutorSetup } from '../typechain-types';
import { deployNewDAO } from "./utils/dao"
import metadata from '../contracts/plugins/action-executer-plugin/build-metadata.json';
import {
  ActionsExecutor__factory
} from '../typechain-types';

let defaultData: any;

const abiCoder = ethers.utils.defaultAbiCoder;


describe('ActionsExecutorSetup', function () {
  let signers: SignerWithAddress[];
  let pluginSetup: ActionsExecutorSetup;
  let targetDao: any;

  before(async () => {
    signers = await ethers.getSigners();
    targetDao = await deployNewDAO(signers[0].address);

    const PluginSetup = await ethers.getContractFactory(
      'ActionsExecutorSetup'
    );

    pluginSetup = await PluginSetup.deploy();

    defaultData = abiCoder.encode(metadata.pluginSetupABI.prepareInstallation, []);
  });


  describe('prepareInstallation', async () => {
    it('fails if data is empty, or not of minimum length', async () => {
      await expect(
        pluginSetup.prepareInstallation(
          targetDao.address,
          defaultData
        )
      ).not.to.be.reverted;
    });

    it('correctly returns plugin, helpers and permissions', async () => {
      const nonce = await ethers.provider.getTransactionCount(
        pluginSetup.address
      );
      const anticipatedPluginAddress = ethers.utils.getContractAddress({
        from: pluginSetup.address,
        nonce,
      });

      const {
        plugin,
        preparedSetupData: { helpers, permissions },
      } = await pluginSetup.callStatic.prepareInstallation(
        targetDao.address,
        defaultData
      );

      expect(plugin).to.be.equal(anticipatedPluginAddress);
      expect(helpers.length).to.be.equal(0);
      expect(permissions.length).to.be.equal(2);
    });

    it('correctly sets up the plugin', async () => {
      const daoAddress = targetDao.address;

      const nonce = await ethers.provider.getTransactionCount(
        pluginSetup.address
      );
      const anticipatedPluginAddress = ethers.utils.getContractAddress({
        from: pluginSetup.address,
        nonce,
      });

      await pluginSetup.prepareInstallation(daoAddress, defaultData);

      const factory = new ActionsExecutor__factory(signers[0]);
      const pluginAddressContract = factory.attach(anticipatedPluginAddress);

      expect(await pluginAddressContract.dao()).to.be.equal(daoAddress);
    });
  });

});