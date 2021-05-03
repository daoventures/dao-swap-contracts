const BEP20TokenImplementation = artifacts.require("BEP20TokenImplementation");
const BSCSwapAgentImpl = artifacts.require("BSCSwapAgentImpl");
const ETHSwapAgentImpl = artifacts.require("ETHSwapAgentImpl");

const ETHSwapAgentUpgradeableProxy = artifacts.require("ETHSwapAgentUpgradeableProxy");
const BSCSwapAgentUpgradeableProxy = artifacts.require("BSCSwapAgentUpgradeableProxy");

const ERC20ABC = artifacts.require("ERC20ABC");
const ERC20DEF = artifacts.require("ERC20DEF");
const ERC20EMPTYSYMBOL = artifacts.require("ERC20EMPTYSYMBOL");
const ERC20EMPTYNAME = artifacts.require("ERC20EMPTYNAME");
const ERC20DVG = artifacts.require("ERC20DVG");
const BEP20DVG = artifacts.require("BEP20DVG");

const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

require('dotenv').config();

module.exports = function(deployer, network, accounts) {
    swapOwner = accounts[0];
    proxyAdmin = bep20ProxyAdmin = accounts[1];

    const isBsc = (network.indexOf('bsc') === 0);
    const isDevelopment = (network === 'development');

    const ethDvg = (network === 'mainnet') ? process.env.DVG_ETH_MAINNET_ADDRESS : process.env.DVG_ETH_ROPSTEN_ADDRESS;
    const bscDvg = (network === 'mainnet') ? process.env.DVG_BSC_MAINNET_ADDRESS : process.env.DVG_BSC_TESTNET_ADDRESS;

    if (!ethDvg) {
        console.error('Please put the Ethereum DVG token address in .env');
        return;
    }
    if (!bscDvg) {
        console.error('Please put the BSC DVG token address in .env');
        return;
    }
    if (isBsc && process.env.ETH_REGISTER_TX === '') {
        console.error('Please put the registerTx to ETH_REGISTER_TX in .env');
        return;
    }

    deployer.then(async () => {

        if (isDevelopment) {
            await deployer.deploy(ERC20ABC);
            await deployer.deploy(ERC20DEF);
            await deployer.deploy(ERC20EMPTYSYMBOL);
            await deployer.deploy(ERC20EMPTYNAME);
            await deployer.deploy(ERC20DVG);
            await deployer.deploy(BEP20DVG);
        }

        //
        // BSC
        //
        if (isDevelopment || isBsc) {
            await deployer.deploy(BEP20TokenImplementation);
            await deployer.deploy(BSCSwapAgentImpl);
            const bscSwap = await BSCSwapAgentImpl.deployed()
            const initBscwapData = bscSwap.contract.methods.initialize(BEP20TokenImplementation.address, "100000000000000000", swapOwner, bep20ProxyAdmin).encodeABI();
            await deployer.deploy(BSCSwapAgentUpgradeableProxy, BSCSwapAgentImpl.address, proxyAdmin, initBscwapData);
        }

        //
        // Ethereum
        //
        if (isDevelopment || !isBsc) {
            await deployer.deploy(ETHSwapAgentImpl);
            const ethSwap = await ETHSwapAgentImpl.deployed();
            const initEthSwapData = ethSwap.contract.methods.initialize("1000000000000000", swapOwner).encodeABI();
            await deployer.deploy(ETHSwapAgentUpgradeableProxy, ETHSwapAgentImpl.address, proxyAdmin, initEthSwapData);
        }

        //
        // DVG token
        //
        if (isDevelopment) {
            const ethSwapProxy = await ETHSwapAgentUpgradeableProxy.deployed();
            const bscSwapProxy = await BSCSwapAgentUpgradeableProxy.deployed();
            const ethSwap = await ETHSwapAgentImpl.at(ethSwapProxy.address);
            const bscSwap = await BSCSwapAgentImpl.at(bscSwapProxy.address);
    
            let registerTx = await ethSwap.registerSwapPairWithBep20(ERC20DVG.address, BEP20DVG.address, {from: swapOwner});
            await bscSwap.createSwapPairWithBep20(registerTx.tx, ERC20DVG.address, "DVGToken", "DVG", 18, BEP20DVG.address, {from: swapOwner});

            const bep20DVG = await BEP20DVG.deployed();
            await bep20DVG.addMinter(bscSwap.address, {from: swapOwner});

        } else if (!isBsc) {
            const ethSwapProxy = await ETHSwapAgentUpgradeableProxy.deployed();
            const ethSwap = await ETHSwapAgentImpl.at(ethSwapProxy.address);
    
            let registerTx = await ethSwap.registerSwapPairWithBep20(ethDvg, bscDvg, {from: swapOwner});
            console.log('registerTx: ', registerTx.tx);
            
        } else {
            const bscSwapProxy = await BSCSwapAgentUpgradeableProxy.deployed();
            const bscSwap = await BSCSwapAgentImpl.at(bscSwapProxy.address);
    
            await bscSwap.createSwapPairWithBep20(process.env.ETH_REGISTER_TX, ethDvg, "DVGToken", "DVG", 18, bscDvg, {from: swapOwner});
        }

    });
};
