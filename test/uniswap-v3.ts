import { expect } from "chai";
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deployNewDAO } from "./utils/dao"
import { getMergedABI } from './utils/abi';
import { deployWithProxy } from './utils/proxy';
import { shouldUpgradeCorrectly } from './utils/uups-upgradeable';
import { UPGRADE_PERMISSIONS } from './utils/permissions';
import { OZ_ERRORS } from './utils/error';


describe('Uniswap-v3 plugin', function () {
    let signers: SignerWithAddress[];
    let dao: any;
    let ownerAddress: string;
    let pluginFactoryBytecode: any;
    let plugin: any;
    let mergedAbi: any;
    let owner: SignerWithAddress
    let nonAuthUser: SignerWithAddress
    const SWAP_PERMISSION_ID = ethers.utils.id('SWAP_PERMISSION');
    const EXECUTE_PERMISSION_ID = ethers.utils.id('EXECUTE_PERMISSION');
    const UNISWAP_ROUTER_ADDRESS: string = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
    const WMATIC_ADDRESS: string = '0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889'
    const WETHER_ADDRESS: string = '0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa'
    let impersonatedSigner: SignerWithAddress;

    before(async () => {
        signers = await ethers.getSigners();
        ownerAddress = await signers[0].getAddress();
        owner = signers[0];
        nonAuthUser = signers[2];
        impersonatedSigner = await ethers.getImpersonatedSigner(process.env.IMPERSONATE_SIGNER || "");

        ({ abi: mergedAbi, bytecode: pluginFactoryBytecode } = await getMergedABI(
            // @ts-ignore
            hre,
            'Uniswapv3',
            ['DAO']
        ));

        dao = await deployNewDAO(ownerAddress);

    });

    beforeEach(async function () {
        const PluginFactory = new ethers.ContractFactory(
            mergedAbi,
            pluginFactoryBytecode,
            signers[0]
        );

        plugin = await deployWithProxy(PluginFactory);

        await dao.grant(
            plugin.address,
            ownerAddress,
            SWAP_PERMISSION_ID
        );

        await dao.grant(
            dao.address,
            plugin.address,
            EXECUTE_PERMISSION_ID
        );

        this.upgrade = {
            contract: plugin,
            dao: dao,
            user: signers[8],
        };

    });

    function initializePlugin() {
        return plugin.initialize(dao.address, UNISWAP_ROUTER_ADDRESS);
    }

    describe('Upgrade', () => {
        beforeEach(async function () {
            this.upgrade = {
                contract: plugin,
                dao: dao,
                user: signers[8],
            };
            await plugin.initialize(dao.address, UNISWAP_ROUTER_ADDRESS);
        });

        shouldUpgradeCorrectly(
            UPGRADE_PERMISSIONS.UPGRADE_PLUGIN_PERMISSION_ID,
            'DaoUnauthorized'
        );
    });

    describe('initialize: ', async () => {
        it('reverts if trying to re-initialize', async () => {
            await plugin.initialize(dao.address, UNISWAP_ROUTER_ADDRESS);

            await expect(
                plugin.initialize(dao.address, UNISWAP_ROUTER_ADDRESS)
            ).to.be.revertedWith(OZ_ERRORS.ALREADY_INITIALIZED);
        });
    });


    describe('Managing vault assets: ', async () => {
        beforeEach(async () => {
            await initializePlugin();
        });

        it('Swap tokens in DAO treasury', async () => {
            const ERC20 = await ethers.getContractFactory("ERC20");

            const wmatic = ERC20.attach(WMATIC_ADDRESS)
            const wether = ERC20.attach(WETHER_ADDRESS)
            const poolFee = 3000

            await wmatic.connect(impersonatedSigner).transfer(
                dao.address, ethers.utils.parseEther('0.5')
            )

            const balanceBefore = await wether.balanceOf(dao.address)
            await plugin.swap(
                WMATIC_ADDRESS,
                WETHER_ADDRESS,
                poolFee,
                dao.address,
                ethers.utils.parseEther('0.5'),
                0,
                0)

            const balanceAfter = await wether.balanceOf(dao.address)
            expect(balanceBefore).to.be.equals(0)
            expect(balanceAfter).to.be.greaterThan(balanceBefore)
        })
    })

})
