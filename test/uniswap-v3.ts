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
    DaoAction,
} from "@aragon/sdk-client-common";
import {
    hexToBytes
} from "@aragon/sdk-common";
import { ERC20__factory } from "../typechain-types";
import { toBytes32 } from "./utils/voting";


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
    const PROVIDE_LIQUIDITY_PERMISSION_ID = ethers.utils.id('PROVIDE_LIQUIDITY_PERMISSION');
    const UNISWAP_NON_FUNGIBLE_POSITION_ADDRESS: string = '0xc36442b4a4522e871399cd717abdd847ab11fe88';
    const UNISWAP_ROUTER_ADDRESS: string = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
    const WMATIC_ADDRESS: string = '0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889'
    const WETHER_ADDRESS: string = '0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa'
    const USDC_ADDRESS: string = '0xe9DcE89B076BA6107Bb64EF30678efec11939234'
    const USDT_ADDRESS: string = '0xAcDe43b9E5f72a4F554D4346e69e8e7AC8F352f0'
    const UNISWAP_POSITION_NFT_ADDRESS: string = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88'
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
            plugin.address,
            ownerAddress,
            PROVIDE_LIQUIDITY_PERMISSION_ID
        );

        await dao.grant(
            dao.address,
            ownerAddress,
            EXECUTE_PERMISSION_ID
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
        return plugin.initialize(dao.address, UNISWAP_ROUTER_ADDRESS, UNISWAP_NON_FUNGIBLE_POSITION_ADDRESS);
    }

    describe('Upgrade', () => {
        beforeEach(async function () {
            this.upgrade = {
                contract: plugin,
                dao: dao,
                user: signers[8],
            };
            await plugin.initialize(dao.address, UNISWAP_ROUTER_ADDRESS, UNISWAP_NON_FUNGIBLE_POSITION_ADDRESS);
        });

        shouldUpgradeCorrectly(
            UPGRADE_PERMISSIONS.UPGRADE_PLUGIN_PERMISSION_ID,
            'DaoUnauthorized'
        );
    });

    describe('initialize: ', async () => {
        it('reverts if trying to re-initialize', async () => {
            await plugin.initialize(dao.address, UNISWAP_ROUTER_ADDRESS, UNISWAP_NON_FUNGIBLE_POSITION_ADDRESS);

            await expect(
                plugin.initialize(dao.address, UNISWAP_ROUTER_ADDRESS, UNISWAP_NON_FUNGIBLE_POSITION_ADDRESS)
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

            const iface = ERC20__factory.createInterface()

            const hexData = iface.encodeFunctionData(
                'approve',
                [
                    plugin.address,
                    ethers.utils.parseEther('0.5'),
                ]
            )

            const approve: DaoAction = {
                to: WMATIC_ADDRESS,
                value: ethers.utils.parseEther('0').toBigInt(),
                data: hexToBytes(hexData)
            }

            await dao.execute(toBytes32(1), [approve], 0)

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

        it('Provide liquidity to Uniswap pool tokens in DAO treasury', async () => {
            const ERC20 = await ethers.getContractFactory("ERC20");

            const MintNFTContract = await ethers.getContractAt('IERC721', UNISWAP_POSITION_NFT_ADDRESS)

            const usdc = ERC20.attach(USDC_ADDRESS)
            const usdt = ERC20.attach(USDT_ADDRESS)
            const poolFee = 100
            const tickLower = -887272
            const tickUpper = 887272
            const amount0Desired = 4999999999
            const amount1Desired = 4900289232
            const amount0Min = 4987546679
            const amount1Min = 4888023157

            await usdc.connect(impersonatedSigner).transfer(
                plugin.address, 10000000000
            )

            await usdt.connect(impersonatedSigner).transfer(
                plugin.address, 10000000000
            )

            await plugin.provideLiquidity(
                USDT_ADDRESS,
                USDC_ADDRESS,
                poolFee,
                tickLower,
                tickUpper,
                amount0Desired,
                amount1Desired,
                amount0Min,
                amount1Min
            )

            const positions = await MintNFTContract.balanceOf(dao.address)
            expect(positions).to.be.equal(1)

        })
    })

})
