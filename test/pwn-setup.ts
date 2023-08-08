import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { PwnSetup } from '../typechain-types';
import { deployNewDAO } from "./utils/dao"
import metadata from '../contracts/plugins/pwn/build-metadata.json';
import {
  Pwn__factory
} from '../typechain-types';

let defaultData: any;

const abiCoder = ethers.utils.defaultAbiCoder;


describe('PWNSetup', function () {
  let signers: SignerWithAddress[];
  let pwnSetup: PwnSetup;
  let targetDao: any;
  const pwnSimpleLoanOfferAddress: string = '0xAbA34804D2aDE17dd5064Ac7183e7929E4F940BD'
  const pwnSimpleLoanAddress: string = '0x50160ff9c19fbE2B5643449e1A321cAc15af2b2C'
  const EMPTY_DATA = '0x';

  before(async () => {
    signers = await ethers.getSigners();
    targetDao = await deployNewDAO(signers[0].address);

    const PWNSetup = await ethers.getContractFactory(
      'PwnSetup'
    );

    pwnSetup = await PWNSetup.deploy();

    defaultData = abiCoder.encode(metadata.pluginSetupABI.prepareInstallation, 
      [pwnSimpleLoanOfferAddress, pwnSimpleLoanAddress]
      );
  });


  describe('prepareInstallation', async () => {
    it('fails if data is empty, or not of minimum length', async () => {
      await expect(
        pwnSetup.prepareInstallation(
          targetDao.address,
          defaultData
        )
      ).not.to.be.reverted;
    });

    it('correctly returns plugin, helpers and permissions', async () => {
      const nonce = await ethers.provider.getTransactionCount(
        pwnSetup.address
      );
      const anticipatedPluginAddress = ethers.utils.getContractAddress({
        from: pwnSetup.address,
        nonce,
      });

      const {
        plugin,
        preparedSetupData: { helpers, permissions },
      } = await pwnSetup.callStatic.prepareInstallation(
        targetDao.address,
        defaultData
      );

      expect(plugin).to.be.equal(anticipatedPluginAddress);
      expect(helpers.length).to.be.equal(0);
      expect(permissions.length).to.be.equal(1);
    });

    it('correctly sets up the plugin', async () => {
      const daoAddress = targetDao.address;

      const nonce = await ethers.provider.getTransactionCount(
        pwnSetup.address
      );
      const anticipatedPluginAddress = ethers.utils.getContractAddress({
        from: pwnSetup.address,
        nonce,
      });

      await pwnSetup.prepareInstallation(daoAddress, defaultData);

      const factory = new Pwn__factory(signers[0]);
      const vaultAddressContract = factory.attach(anticipatedPluginAddress);

      expect(await vaultAddressContract.dao()).to.be.equal(daoAddress);
    });
  });

});