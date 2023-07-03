import { expect } from "chai";
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deployNewDAO } from "./utils/dao"
import { getMergedABI } from './utils/abi';
import { deployWithProxy } from './utils/proxy';
import { shouldUpgradeCorrectly } from './utils/uups-upgradeable';
import { UPGRADE_PERMISSIONS } from './utils/permissions';
import { OZ_ERRORS } from './utils/error';
import {
    TestERC20,
    TestERC721,
    TestERC20__factory,
    TestERC721__factory
} from '../typechain-types';


describe('VaultManager plugin', function () {
    let signers: SignerWithAddress[];
    let dao: any;
    let ownerAddress: string;
    let vaultFactoryBytecode: any;
    let vaultManager: any;
    let mergedAbi: any;
    let owner: SignerWithAddress
    let nonAuthUser: SignerWithAddress
    const VAULT_WITHDRAWN_PERMISSION_ID = ethers.utils.id('VAULT_WITHDRAWN_PERMISSION');
    const VAULT_CREATE_PERMISSION_ID = ethers.utils.id('VAULT_CREATE_PERMISSION');
    let testERC20: TestERC20
    let testERC721: TestERC721
    const ERC20_VAULT_NAME: string = "ERC20_VAULT"
    const ERC721_VAULT_NAME: string = "ERC721_VAULT"

    before(async () => {
        signers = await ethers.getSigners();
        ownerAddress = await signers[0].getAddress();
        owner = signers[0];
        nonAuthUser = signers[2];

        ({ abi: mergedAbi, bytecode: vaultFactoryBytecode } = await getMergedABI(
            // @ts-ignore
            hre,
            'VaultManager',
            ['DAO']
        ));

        dao = await deployNewDAO(ownerAddress);

        testERC20 = await new TestERC20__factory(owner).deploy("Test ERC20", "TTOKEN20", 100000)
        testERC721 = await new TestERC721__factory(owner).deploy("Test ERC721", "TTOKEN21")

    });

    beforeEach(async function () {
        const VaultFactory = new ethers.ContractFactory(
            mergedAbi,
            vaultFactoryBytecode,
            signers[0]
        );

        vaultManager = await deployWithProxy(VaultFactory);

        await dao.grant(
            vaultManager.address,
            ownerAddress,
            VAULT_WITHDRAWN_PERMISSION_ID
        );

        await dao.grant(
            vaultManager.address,
            ownerAddress,
            VAULT_CREATE_PERMISSION_ID
        );

        this.upgrade = {
            contract: vaultManager,
            dao: dao,
            user: signers[8],
        };

    });

    function initializePlugin() {
        return vaultManager.initialize(dao.address);
    }

    describe('Upgrade', () => {
        beforeEach(async function () {
            this.upgrade = {
                contract: vaultManager,
                dao: dao,
                user: signers[8],
            };
            await vaultManager.initialize(dao.address);
        });

        shouldUpgradeCorrectly(
            UPGRADE_PERMISSIONS.UPGRADE_PLUGIN_PERMISSION_ID,
            'DaoUnauthorized'
        );
    });

    describe('initialize: ', async () => {
        it('reverts if trying to re-initialize', async () => {
            await vaultManager.initialize(dao.address);

            await expect(
                vaultManager.initialize(dao.address)
            ).to.be.revertedWith(OZ_ERRORS.ALREADY_INITIALIZED);
        });
    });


    describe('Managing vault assets: ', async () => {
        beforeEach(async () => {
            await initializePlugin();
        });

        it('Deposit ERC20 tokens in vault', async () => {

            await vaultManager.createVault(ERC20_VAULT_NAME, []);
            const vaultAddress = await vaultManager.getVault(ERC20_VAULT_NAME);

            const balanceBefore = await testERC20.balanceOf(vaultAddress)

            await testERC20.approve(vaultAddress, 1000)
            await vaultManager.deposit({
                category: 0,
                assetAddress: testERC20.address,
                id: 0,
                amount: 100
            }, ownerAddress,
                ERC20_VAULT_NAME)

            const balanceAfter = await testERC20.balanceOf(vaultAddress)

            expect(balanceBefore).to.be.equals(0)
            expect(balanceAfter).to.be.equals(100)

        });


        it('Deposit ERC721 tokens in vault', async () => {

            await vaultManager.createVault(ERC721_VAULT_NAME, []);
            const vaultAddress = await vaultManager.getVault(ERC721_VAULT_NAME);

            const balanceBefore = await testERC721.balanceOf(vaultAddress)

            await testERC721.mint(ownerAddress, 0)

            await testERC721.approve(vaultAddress, 0)
            await vaultManager.deposit({
                category: 1,
                assetAddress: testERC721.address,
                id: 0,
                amount: 0
            }, ownerAddress,
                ERC721_VAULT_NAME
            )

            const balanceAfter = await testERC721.balanceOf(vaultAddress)

            expect(balanceBefore).to.be.equals(0)
            expect(balanceAfter).to.be.equals(1)

        });

        it('Should revert not authorized withdrawn ERC20', async () => {

            await vaultManager.createVault(ERC20_VAULT_NAME, []);
            const vaultAddress = await vaultManager.getVault(ERC20_VAULT_NAME);

            const balanceBefore = await testERC20.balanceOf(vaultAddress)

            await testERC20.approve(vaultAddress, 1000)
            await vaultManager.deposit({
                category: 0,
                assetAddress: testERC20.address,
                id: 0,
                amount: 100
            }, ownerAddress,
                ERC20_VAULT_NAME)

            const balanceAfter = await testERC20.balanceOf(vaultAddress)

            expect(balanceBefore).to.be.equals(0)
            expect(balanceAfter).to.be.equals(100)

            await expect(vaultManager.connect(nonAuthUser).withdrawn({
                category: 0,
                assetAddress: testERC20.address,
                id: 0,
                amount: 100
            }, nonAuthUser.address,
                ERC20_VAULT_NAME)).to.be.revertedWithCustomError(vaultManager, 'DaoUnauthorized')
                .withArgs(
                    dao.address,
                    vaultManager.address,
                    nonAuthUser.address,
                    VAULT_WITHDRAWN_PERMISSION_ID
                );

        });


        it('Should revert not authorized withdrawn ERC721', async () => {

            await vaultManager.createVault(ERC721_VAULT_NAME, []);
            const vaultAddress = await vaultManager.getVault(ERC721_VAULT_NAME);

            const balanceBefore = await testERC721.balanceOf(vaultAddress)

            await testERC721.mint(ownerAddress, 1)

            await testERC721.approve(vaultAddress, 1)
            await vaultManager.deposit({
                category: 1,
                assetAddress: testERC721.address,
                id: 1,
                amount: 0
            }, ownerAddress,
                ERC721_VAULT_NAME)

            const balanceAfter = await testERC721.balanceOf(vaultAddress)

            expect(balanceBefore).to.be.equals(0)
            expect(balanceAfter).to.be.equals(1)

            await expect(vaultManager.connect(nonAuthUser).withdrawn({
                category: 1,
                assetAddress: testERC721.address,
                id: 1,
                amount: 0
            }, nonAuthUser.address,
                ERC721_VAULT_NAME)).to.be.revertedWithCustomError(vaultManager, 'DaoUnauthorized')
                .withArgs(
                    dao.address,
                    vaultManager.address,
                    nonAuthUser.address,
                    VAULT_WITHDRAWN_PERMISSION_ID
                );
        });

        it('Should withdrawn erc20 from vault', async () => {

            await vaultManager.createVault(ERC20_VAULT_NAME, [ownerAddress]);
            const vaultAddress = await vaultManager.getVault(ERC20_VAULT_NAME);

            const balanceVaultBefore = await testERC20.balanceOf(vaultAddress)

            await testERC20.approve(vaultAddress, 1000)
            await vaultManager.deposit({
                category: 0,
                assetAddress: testERC20.address,
                id: 0,
                amount: 100
            }, ownerAddress,
                ERC20_VAULT_NAME)

            const balanceVaultAfter = await testERC20.balanceOf(vaultAddress)

            expect(balanceVaultBefore).to.be.equals(0)
            expect(balanceVaultAfter).to.be.equals(100)

            const balanceUserBefore = await testERC20.balanceOf(nonAuthUser.address)

            await vaultManager.withdrawn({
                category: 0,
                assetAddress: testERC20.address,
                id: 0,
                amount: 100
            }, nonAuthUser.address,
                ERC20_VAULT_NAME)

            const balanceUserAfter = await testERC20.balanceOf(nonAuthUser.address)

            expect(balanceUserBefore).to.be.equals(0)
            expect(balanceUserAfter).to.be.equals(100)

        });

        it('Should withdrawn erc721 from vault', async () => {

            await vaultManager.createVault(ERC721_VAULT_NAME, [ownerAddress]);
            const vaultAddress = await vaultManager.getVault(ERC721_VAULT_NAME);

            const balanceVaultBefore = await testERC721.balanceOf(vaultAddress)

            await testERC721.mint(ownerAddress, 2)

            await testERC721.approve(vaultAddress, 2)
            await vaultManager.deposit({
                category: 1,
                assetAddress: testERC721.address,
                id: 2,
                amount: 0
            }, ownerAddress,
                ERC721_VAULT_NAME)

            const balanceVaultAfter = await testERC721.balanceOf(vaultAddress)

            expect(balanceVaultBefore).to.be.equals(0)
            expect(balanceVaultAfter).to.be.equals(1)

            const balanceUserBefore = await testERC721.balanceOf(nonAuthUser.address)

            await vaultManager.withdrawn({
                category: 1,
                assetAddress: testERC721.address,
                id: 2,
                amount: 0
            }, nonAuthUser.address,
                ERC721_VAULT_NAME)

            const balanceUserAfter = await testERC721.balanceOf(nonAuthUser.address)

            expect(balanceUserBefore).to.be.equals(0)
            expect(balanceUserAfter).to.be.equals(1)

        })
    })
});