import { expect } from "chai";
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deployNewDAO } from "./utils/dao"
import { getMergedABI } from './utils/abi';
import { deployWithProxy } from './utils/proxy';
import { shouldUpgradeCorrectly } from './utils/uups-upgradeable';
import { UPGRADE_PERMISSIONS } from './utils/permissions';
import { OZ_ERRORS } from './utils/error';


describe('PWN plugin', function () {
    let signers: SignerWithAddress[];
    let dao: any;
    let ownerAddress: string;
    let pluginFactoryBytecode: any;
    let plugin: any;
    let mergedAbi: any;
    const MAKE_OFFER_PERMISSION_ID = ethers.utils.id('MAKE_OFFER_PERMISSION');
    const pwnSimpleLoanOfferAddress: string = '0xAbA34804D2aDE17dd5064Ac7183e7929E4F940BD'
    const pwnSimpleLoanAddress: string = '0x50160ff9c19fbE2B5643449e1A321cAc15af2b2C'
    const WETH_ADDRESS: string = '0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa'
    const USDC_ADDRESS: string = '0xe9DcE89B076BA6107Bb64EF30678efec11939234'
    let validOffer: any;


    before(async () => {
        signers = await ethers.getSigners();
        ownerAddress = await signers[0].getAddress();

        ({ abi: mergedAbi, bytecode: pluginFactoryBytecode } = await getMergedABI(
            // @ts-ignore
            hre,
            'Pwn',
            ['DAO']
        ));

        dao = await deployNewDAO(ownerAddress);
    });

    beforeEach(async function () {
        const VaultFactory = new ethers.ContractFactory(
            mergedAbi,
            pluginFactoryBytecode,
            signers[0]
        );

        plugin = await deployWithProxy(VaultFactory);

        await dao.grant(
            plugin.address,
            ownerAddress,
            MAKE_OFFER_PERMISSION_ID
        );

        this.upgrade = {
            contract: plugin,
            dao: dao,
            user: signers[8],
        };


        validOffer = {
            collateralCategory: 0,
            collateralAddress: WETH_ADDRESS,
            collateralId: 0,
            collateralAmount: 1000,
            loanAssetAddress: USDC_ADDRESS,
            loanAmount: 1000,
            loanYield: 5,
            duration: 1000,
            expiration: 0,
            borrower: ethers.constants.AddressZero,
            lender: plugin.address,
            isPersistent: false,
            nonce: ethers.utils.id("nonce_1")
        };

    });

    function initializePlugin() {
        return plugin.initialize(
            dao.address,
            pwnSimpleLoanOfferAddress,
            pwnSimpleLoanAddress
        );
    }

    describe('Upgrade', () => {
        beforeEach(async function () {
            this.upgrade = {
                contract: plugin,
                dao: dao,
                user: signers[8],
            };
            await plugin.initialize(
                dao.address,
                pwnSimpleLoanOfferAddress,
                pwnSimpleLoanAddress
            );
        });

        shouldUpgradeCorrectly(
            UPGRADE_PERMISSIONS.UPGRADE_PLUGIN_PERMISSION_ID,
            'DaoUnauthorized'
        );
    });

    describe('initialize: ', async () => {
        it('reverts if trying to re-initialize', async () => {
            await plugin.initialize(
                dao.address,
                pwnSimpleLoanOfferAddress,
                pwnSimpleLoanAddress
            );

            await expect(
                plugin.initialize(
                    dao.address,
                    pwnSimpleLoanOfferAddress,
                    pwnSimpleLoanAddress
                )
            ).to.be.revertedWith(OZ_ERRORS.ALREADY_INITIALIZED);
        });
    });


    describe('Managing vault assets: ', async () => {
        beforeEach(async () => {
            await initializePlugin();
        });

        it('Should make an offer', async () => {
            await plugin.makeOffer(validOffer);
        });


        it('DAO makes an offer and borrower buys it', async () => {

            await plugin.makeOffer(validOffer);
            const borrower = signers[4]

            const pwnSimpleOffer = await ethers.getContractAt('IPWNSimpleLoan', pwnSimpleLoanAddress)
            const pwnSimpleLoanListOffer = await ethers.getContractAt(
                'IPWNSimpleLoanListOffer',
                pwnSimpleLoanOfferAddress
            )

            const offerHash = await pwnSimpleLoanListOffer.getOfferHash(validOffer)
            const signature = await borrower.signMessage(offerHash)

            const factoryData = await pwnSimpleLoanListOffer.encodeLoanTermsFactoryData(validOffer)

            const weth = await ethers.getContractAt('ERC20', WETH_ADDRESS)
            const usdc = await ethers.getContractAt('ERC20', USDC_ADDRESS)
            await usdc.transfer(plugin.address, validOffer.loanAmount)

            await weth.transfer(borrower.address, validOffer.collateralAmount)
            await weth.connect(borrower).approve(pwnSimpleLoanAddress, validOffer.collateralAmount)

            const balanceBefore = await usdc.balanceOf(borrower.address)

            await pwnSimpleOffer.connect(borrower).createLOAN(
                pwnSimpleLoanOfferAddress,
                factoryData,
                signature,
                [],
                []
            )

            const balanceAfter = await usdc.balanceOf(borrower.address)
            expect(balanceAfter).to.be.equals(Number(balanceBefore) + validOffer.loanAmount)

        });


    })
});