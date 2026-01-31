<script>
	import Sidebar from "../../../components/inputs/sidebar/Sidebar.svelte";
	import BackupCodeStep from "./steps/BackupCodeStep.svelte";
	import FormStep from "./steps/FormStep.svelte";
	import ScanStep from "./steps/ScanStep.svelte";
	import VerifyStep from "./steps/VerifyStep.svelte";

</script>

<div>
    <FormStep />
    <ScanStep totpUri={"https://www.conecopia.com/ghjfskkgshdfs/dsfdfsd/f/dsf/df/"} />
    <VerifyStep />
    <BackupCodeStep codes={["sdfhjkfhwu4", "fjhaskfjfkjs", "sfhsejrfs34", "aertye4hrgs", "dsgjrsfejfu3", "fhwiuhfskelua", "gearfshehje", "hawesbfeihkfhw",]} />
</div>