import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { VaultManagerSetup } from '../typechain-types';
import { deployNewDAO } from "./utils/dao"
import metadata from '../contracts/vault-plugin/build-metadata.json';
import {
  VaultManager__factory
} from '../typechain-types';

let defaultData: any;

const abiCoder = ethers.utils.defaultAbiCoder;


describe('VaultManagerSetup', function () {
  let signers: SignerWithAddress[];
  let vaultSetup: VaultManagerSetup;
  let targetDao: any;
  const EMPTY_DATA = '0x';

  before(async () => {
    signers = await ethers.getSigners();
    targetDao = await deployNewDAO(signers[0].address);

    const VaultSetup = await ethers.getContractFactory(
      'VaultManagerSetup'
    );

    vaultSetup = await VaultSetup.deploy();

    defaultData = abiCoder.encode(metadata.pluginSetupABI.prepareInstallation, []);
  });


  describe('prepareInstallation', async () => {
    it('fails if data is empty, or not of minimum length', async () => {
      await expect(
        vaultSetup.prepareInstallation(
          targetDao.address,
          defaultData
        )
      ).not.to.be.reverted;
    });

    it('correctly returns plugin, helpers and permissions', async () => {
      const nonce = await ethers.provider.getTransactionCount(
        vaultSetup.address
      );
      const anticipatedPluginAddress = ethers.utils.getContractAddress({
        from: vaultSetup.address,
        nonce,
      });

      const {
        plugin,
        preparedSetupData: { helpers, permissions },
      } = await vaultSetup.callStatic.prepareInstallation(
        targetDao.address,
        defaultData
      );

      expect(plugin).to.be.equal(anticipatedPluginAddress);
      expect(helpers.length).to.be.equal(0);
      expect(permissions.length).to.be.equal(0);
    });

    it('correctly sets up the plugin', async () => {
      const daoAddress = targetDao.address;

      const nonce = await ethers.provider.getTransactionCount(
        vaultSetup.address
      );
      const anticipatedPluginAddress = ethers.utils.getContractAddress({
        from: vaultSetup.address,
        nonce,
      });

      await vaultSetup.prepareInstallation(daoAddress, defaultData);

      const factory = new VaultManager__factory(signers[0]);
      const vaultAddressContract = factory.attach(anticipatedPluginAddress);

      expect(await vaultAddressContract.dao()).to.be.equal(daoAddress);
    });
  });

});